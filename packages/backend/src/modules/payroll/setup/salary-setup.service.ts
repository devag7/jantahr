import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../common/types';
import { fiscalYearStartYear, monthRange, toDateOnly } from '../../../common/utils/dates';
import { num, round2 } from '../../../common/utils/money';
import { PrismaService } from '../../../prisma/prisma.service';
import { validateFormula } from '../engine/formula';
import { currentPfCeiling } from '../engine/config';
import { calcESI, calcPF } from '../engine/statutory';
import { PayProfileService, RESERVED_VARS } from '../runs/pay-profile.service';
import {
  AdditionalSalaryDto, AssignmentDto, BulkAssignmentDto, LoanDto, SalaryComponentDto, SalaryStructureDto, StructurePreviewDto,
  UpdateSalaryComponentDto, UpdateSalaryStructureDto,
} from '../payroll.dto';

import { errorMessage } from '../../../common/utils/errors';
@Injectable()
export class SalarySetupService {
  constructor(private prisma: PrismaService, private profile: PayProfileService) {}

  // ---- components ----------------------------------------------------------
  components(companyId: string) {
    return this.prisma.salaryComponent.findMany({ where: { companyId }, orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] });
  }

  async createComponent(companyId: string, dto: SalaryComponentDto) {
    const abbr = dto.abbr.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!abbr || /^\d/.test(abbr)) throw new BadRequestException('Abbreviation must start with a letter and contain only A-Z, 0-9, _');
    if (RESERVED_VARS.includes(abbr)) throw new BadRequestException(`${abbr} is a reserved name`);
    if (await this.prisma.salaryComponent.findFirst({ where: { companyId, abbr } })) throw new BadRequestException(`A component with abbreviation ${abbr} already exists`);
    return this.prisma.salaryComponent.create({ data: { ...dto, abbr, companyId, dependsOnPaymentDays: dto.dependsOnPaymentDays ?? dto.type === 'EARNING' } });
  }

  async updateComponent(companyId: string, id: string, dto: UpdateSalaryComponentDto) {
    const c = await this.prisma.salaryComponent.findFirst({ where: { id, companyId } });
    if (!c) throw new NotFoundException('Component not found');
    if (c.isStatutory && (dto.abbr || dto.type)) throw new BadRequestException('Statutory components cannot be renamed or retyped');
    const { abbr, ...rest } = dto;
    return this.prisma.salaryComponent.update({ where: { id }, data: { ...rest, ...(abbr && !c.isStatutory ? { abbr: abbr.toUpperCase() } : {}) } });
  }

  async deleteComponent(companyId: string, id: string) {
    const c = await this.prisma.salaryComponent.findFirst({ where: { id, companyId }, include: { _count: { select: { structureComponents: true, slipEarnings: true, slipDeductions: true } } } });
    if (!c) throw new NotFoundException('Component not found');
    if (c.isStatutory) throw new BadRequestException('Statutory components cannot be deleted');
    if (c._count.structureComponents || c._count.slipEarnings || c._count.slipDeductions) throw new BadRequestException('Component is used in structures or salary slips');
    await this.prisma.salaryComponent.delete({ where: { id } });
    return { ok: true };
  }

  // ---- structures ----------------------------------------------------------
  structures(companyId: string) {
    return this.prisma.salaryStructure.findMany({
      where: { companyId }, orderBy: { name: 'asc' },
      include: { components: { orderBy: { sortOrder: 'asc' }, include: { component: { select: { id: true, name: true, abbr: true, type: true } } } }, _count: { select: { assignments: true } } },
    });
  }

  private async validateStructureInput(companyId: string, comps: SalaryStructureDto['components']) {
    const rows = await this.prisma.salaryComponent.findMany({ where: { companyId, id: { in: comps.map((c) => c.componentId) } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const seen = new Set<string>();
    const known: string[] = [...RESERVED_VARS];
    for (const c of comps) {
      const row = byId.get(c.componentId);
      if (!row) throw new BadRequestException('Unknown salary component in structure');
      if (row.isStatutory) throw new BadRequestException(`${row.name} is computed by the statutory engine and must not be part of the structure`);
      if (seen.has(row.id)) throw new BadRequestException(`${row.name} appears more than once`);
      seen.add(row.id);
      const formula = c.formula || row.formula;
      if (formula) {
        const err = validateFormula(formula, known);
        if (err) throw new BadRequestException(`${row.name}: ${err}`);
      } else if (c.amount === undefined || c.amount === null) throw new BadRequestException(`${row.name} needs a formula or a fixed amount`);
      known.push(row.abbr);
    }
    if (!rows.some((r) => r.componentType === 'BASIC')) throw new BadRequestException('A structure needs a Basic component (needed for PF, HRA and gratuity)');
  }

  async createStructure(companyId: string, dto: SalaryStructureDto) {
    await this.validateStructureInput(companyId, dto.components);
    return this.prisma.salaryStructure.create({
      data: {
        companyId, name: dto.name, description: dto.description, payrollFrequency: dto.payrollFrequency || 'MONTHLY', isActive: dto.isActive ?? true,
        components: { create: dto.components.map((c, i) => ({ componentId: c.componentId, formula: c.formula || null, amount: c.amount ?? null, sortOrder: i + 1 })) },
      },
      include: { components: true },
    });
  }

  async updateStructure(companyId: string, id: string, dto: UpdateSalaryStructureDto) {
    if (!(await this.prisma.salaryStructure.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Structure not found');
    if (dto.components) await this.validateStructureInput(companyId, dto.components);
    return this.prisma.$transaction(async (tx) => {
      if (dto.components) await tx.salaryStructureComponent.deleteMany({ where: { structureId: id } });
      return tx.salaryStructure.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.components ? { components: { create: dto.components.map((c, i) => ({ componentId: c.componentId, formula: c.formula || null, amount: c.amount ?? null, sortOrder: i + 1 })) } } : {}),
        },
        include: { components: true },
      });
    });
  }

  async deleteStructure(companyId: string, id: string) {
    const s = await this.prisma.salaryStructure.findFirst({ where: { id, companyId }, include: { _count: { select: { assignments: true } } } });
    if (!s) throw new NotFoundException('Structure not found');
    if (s._count.assignments) throw new BadRequestException('Structure is assigned to employees; deactivate it instead');
    await this.prisma.$transaction([this.prisma.salaryStructureComponent.deleteMany({ where: { structureId: id } }), this.prisma.salaryStructure.delete({ where: { id } })]);
    return { ok: true };
  }

  /** Monthly breakup + employer cost for a structure at a CTC. */
  async preview(companyId: string, dto: StructurePreviewDto) {
    const structure = await this.prisma.salaryStructure.findFirst({ where: { id: dto.salaryStructureId, companyId }, include: { components: { include: { component: true }, orderBy: { sortOrder: 'asc' } } } });
    if (!structure) throw new NotFoundException('Structure not found');
    const [company, emp] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      dto.employeeId ? this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } }) : null,
    ]);
    const pfOn = company.pfEnabled && (emp?.pfApplicable ?? true);
    const { days } = monthRange(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1);
    const lines = this.profile.evaluate(structure, dto.ctc, 0, { totalDays: days, pfApplicable: pfOn }).filter((l) => l.type === 'EARNING');
    const gross = lines.reduce((s, l) => s + l.amount, 0);
    const pfWages = lines.filter((l) => l.isPfApplicable).reduce((s, l) => s + l.amount, 0);
    const esiWages = lines.filter((l) => l.isEsiApplicable).reduce((s, l) => s + l.amount, 0);
    const pf = pfOn ? calcPF(pfWages, currentPfCeiling()) : calcPF(0, currentPfCeiling());
    const esi = company.esiEnabled && (emp?.esiApplicable ?? true) ? calcESI(esiWages) : calcESI(0);
    const basic = lines.filter((l) => l.componentType === 'BASIC').reduce((s, l) => s + l.amount, 0);
    return {
      monthly: lines.map((l) => ({ name: l.name, abbr: l.abbr, monthly: l.amount, annual: l.amount * 12 })),
      grossMonthly: gross, grossAnnual: gross * 12,
      employer: { pf: pf.employerTotal, edli: pf.edli, admin: pf.adminCharges, esi: esi.employer, gratuity: Math.round(basic * 0.0481) },
      employee: { pf: pf.employeeEpf, esi: esi.employee },
      ctcMonthly: round2(dto.ctc / 12),
    };
  }

  // ---- assignments ---------------------------------------------------------
  async assign(user: AuthUser, dto: AssignmentDto) {
    const [emp, structure] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId: user.companyId } }),
      this.prisma.salaryStructure.findFirst({ where: { id: dto.salaryStructureId, companyId: user.companyId, isActive: true } }),
    ]);
    if (!emp) throw new NotFoundException('Employee not found');
    if (!structure) throw new BadRequestException('Salary structure not found or inactive');
    const fromDate = toDateOnly(dto.fromDate);
    if (fromDate < emp.dateOfJoining) throw new BadRequestException('Assignment cannot start before the date of joining');

    // Revising a period whose payroll is already approved would silently diverge from paid amounts
    const locked = await this.prisma.salarySlip.findFirst({ where: { employeeId: emp.id, status: { in: ['APPROVED', 'PAID'] }, endDate: { gte: fromDate } } });
    if (locked) throw new BadRequestException(`Payroll is already approved from ${String(locked.month).padStart(2, '0')}/${locked.year}; a revision must start after that period`);

    const a = await this.prisma.$transaction(async (tx) => {
      const row = await tx.salaryStructureAssignment.upsert({
        where: { employeeId_fromDate: { employeeId: emp.id, fromDate } },
        create: { employeeId: emp.id, salaryStructureId: structure.id, companyId: user.companyId, fromDate, base: dto.base, variable: dto.variable ?? 0, taxRegime: dto.taxRegime || 'NEW' },
        update: { salaryStructureId: structure.id, base: dto.base, variable: dto.variable ?? 0, ...(dto.taxRegime ? { taxRegime: dto.taxRegime } : {}) },
      });
      await tx.employee.update({ where: { id: emp.id }, data: { ctc: dto.base } });
      return row;
    });
    return a;
  }

  async bulkAssign(user: AuthUser, dto: BulkAssignmentDto) {
    const emps = await this.prisma.employee.findMany({ where: { id: { in: dto.employeeIds }, companyId: user.companyId } });
    const done: string[] = [];
    const failed: { employeeId: string; reason: string }[] = [];
    for (const e of emps) {
      if (!e.ctc) { failed.push({ employeeId: e.id, reason: 'CTC is not set on the employee profile' }); continue; }
      try {
        await this.assign(user, { employeeId: e.id, salaryStructureId: dto.salaryStructureId, fromDate: dto.fromDate, base: num(e.ctc), taxRegime: dto.taxRegime });
        done.push(e.id);
      } catch (err) {
        failed.push({ employeeId: e.id, reason: errorMessage(err) });
      }
    }
    return { assigned: done.length, failed };
  }

  assignments(companyId: string, employeeId?: string) {
    return this.prisma.salaryStructureAssignment.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) }, orderBy: [{ employeeId: 'asc' }, { fromDate: 'desc' }],
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, salaryStructure: { select: { name: true } } }, take: 500,
    });
  }

  // ---- additional salary ---------------------------------------------------
  additional(companyId: string, employeeId?: string) {
    return this.prisma.additionalSalary.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) }, orderBy: { payrollDate: 'desc' }, take: 300,
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, salaryComponent: { select: { name: true, abbr: true } } },
    });
  }

  private async assertMonthOpen(employeeId: string, date: Date) {
    const locked = await this.prisma.salarySlip.findFirst({ where: { employeeId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, status: { in: ['APPROVED', 'PAID'] } } });
    if (locked) throw new BadRequestException('Payroll for that month is already approved');
  }

  async createAdditional(companyId: string, dto: AdditionalSalaryDto) {
    const [emp, comp] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } }),
      this.prisma.salaryComponent.findFirst({ where: { id: dto.salaryComponentId, companyId } }),
    ]);
    if (!emp) throw new NotFoundException('Employee not found');
    if (!comp || comp.isStatutory) throw new BadRequestException('Choose a non-statutory earning/deduction component');
    const payrollDate = toDateOnly(dto.payrollDate);
    await this.assertMonthOpen(emp.id, payrollDate);
    return this.prisma.additionalSalary.create({
      data: {
        employeeId: emp.id, companyId, salaryComponentId: comp.id, amount: dto.amount, payrollDate, reason: dto.reason, type: comp.type,
        isRecurring: !!dto.isRecurring, fromDate: dto.fromDate ? toDateOnly(dto.fromDate) : null, toDate: dto.toDate ? toDateOnly(dto.toDate) : null,
      },
    });
  }

  async deleteAdditional(companyId: string, id: string) {
    const a = await this.prisma.additionalSalary.findFirst({ where: { id, companyId } });
    if (!a) throw new NotFoundException('Entry not found');
    await this.assertMonthOpen(a.employeeId, a.payrollDate);
    await this.prisma.additionalSalary.delete({ where: { id } });
    return { ok: true };
  }

  // ---- loans ---------------------------------------------------------------
  loans(companyId: string, employeeId?: string) {
    return this.prisma.employeeLoan.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) }, orderBy: { createdAt: 'desc' }, take: 300,
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
    });
  }

  async createLoan(companyId: string, dto: LoanDto) {
    if (!(await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } }))) throw new NotFoundException('Employee not found');
    const emi = Math.ceil(dto.principal / dto.totalInstallments);
    return this.prisma.employeeLoan.create({
      data: { employeeId: dto.employeeId, companyId, loanType: dto.loanType || 'LOAN', principal: dto.principal, emi, totalInstallments: dto.totalInstallments, outstanding: dto.principal, startDate: toDateOnly(dto.startDate), reason: dto.reason },
    });
  }

  async closeLoan(companyId: string, id: string) {
    const l = await this.prisma.employeeLoan.findFirst({ where: { id, companyId } });
    if (!l) throw new NotFoundException('Loan not found');
    return this.prisma.employeeLoan.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  fyOf(date: Date) {
    return fiscalYearStartYear(date);
  }
}
