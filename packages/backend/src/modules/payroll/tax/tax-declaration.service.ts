import { ExemptionCode, totalAllowanceExemption } from '../engine/allowances';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../../../common/access/access.service';
import { AuthUser } from '../../../common/types';
import { fiscalYearRange, fiscalYearStartYear, todayIST } from '../../../common/utils/dates';
import { num } from '../../../common/utils/money';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { computeTax, hraExemption } from '../engine/tax';
import { currentPfCeiling } from '../engine/config';
import { calcPF } from '../engine/statutory';
import { DeclarationDto } from '../payroll.dto';
import { PayProfileService } from '../runs/pay-profile.service';
import { PayrollRunService } from '../runs/payroll-run.service';
import { TdsService } from './tds.service';

import { ApprovalStatus } from '@prisma/client';
@Injectable()
export class TaxDeclarationService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private runs: PayrollRunService,
    private tax: TdsService,
    private profile: PayProfileService,
    private notifications: NotificationsService,
  ) {}

  categories() {
    return this.prisma.taxExemptionCategory.findMany({ include: { subCategories: { orderBy: { name: 'asc' } } }, orderBy: { section: 'asc' } });
  }

  private currentFy() {
    return fiscalYearStartYear(todayIST());
  }

  async getMine(user: AuthUser, fyStartYear?: number) {
    const empId = this.access.requireEmployee(user);
    const fy = fyStartYear ?? this.currentFy();
    const period = await this.runs.ensurePayrollPeriod(user.companyId, fy);
    const dec = await this.prisma.employeeTaxDeclaration.findUnique({
      where: { employeeId_payrollPeriodId: { employeeId: empId, payrollPeriodId: period.id } }, include: { details: { include: { subCategory: true } } },
    });
    return { fyStartYear: fy, declaration: dec };
  }

  async saveMine(user: AuthUser, dto: DeclarationDto) {
    const empId = this.access.requireEmployee(user);
    const fy = dto.fyStartYear ?? this.currentFy();
    const period = await this.runs.ensurePayrollPeriod(user.companyId, fy);
    const existing = await this.prisma.employeeTaxDeclaration.findUnique({ where: { employeeId_payrollPeriodId: { employeeId: empId, payrollPeriodId: period.id } } });
    if (existing?.status === 'APPROVED') throw new BadRequestException('Your declaration is approved and locked. Contact HR to reopen it.');

    const subIds = (dto.details || []).map((d) => d.subCategoryId);
    const subs = await this.prisma.taxExemptionSubCategory.findMany({ where: { id: { in: subIds } }, include: { category: true } });
    if (subs.length !== new Set(subIds).size) throw new BadRequestException('Unknown investment category');
    const subMap = new Map(subs.map((s) => [s.id, s]));
    for (const d of dto.details || []) {
      const s = subMap.get(d.subCategoryId)!;
      if (d.declaredAmount > num(s.maxAmount)) throw new BadRequestException(`${s.name}: maximum allowed is ₹${num(s.maxAmount).toLocaleString('en-IN')}`);
    }
    const total = (dto.details || []).reduce((sum, d) => sum + d.declaredAmount, 0);

    return this.prisma.$transaction(async (tx) => {
      const base = {
        taxRegime: dto.taxRegime, monthlyRent: dto.monthlyRent ?? 0, rentedInMetro: !!dto.rentedInMetro, childrenCount: dto.childrenCount ?? 0, homeLoanInterest: dto.homeLoanInterest ?? 0,
        totalDeclaredAmount: total, isSubmitted: !!dto.submit, status: 'PENDING' as const,
      };
      const rec = existing
        ? await tx.employeeTaxDeclaration.update({ where: { id: existing.id }, data: base })
        : await tx.employeeTaxDeclaration.create({ data: { ...base, employeeId: empId, companyId: user.companyId, payrollPeriodId: period.id } });
      if (dto.details) {
        await tx.taxDeclarationDetail.deleteMany({ where: { declarationId: rec.id } });
        await tx.taxDeclarationDetail.createMany({ data: dto.details.filter((d) => d.declaredAmount > 0).map((d) => ({ declarationId: rec.id, subCategoryId: d.subCategoryId, declaredAmount: d.declaredAmount })) });
      }
      return tx.employeeTaxDeclaration.findUniqueOrThrow({ where: { id: rec.id }, include: { details: { include: { subCategory: true } } } });
    }).then(async (rec) => {
      if (dto.submit) await this.notifications.notifyRoles(user.companyId, ['HR_ADMIN', 'PAYROLL_ADMIN'], { title: 'Tax declaration submitted', message: 'An employee submitted an investment declaration for review', type: 'APPROVAL', link: '/admin/payroll' });
      return rec;
    });
  }

  async list(companyId: string, fyStartYear?: number, status?: string) {
    const fy = fyStartYear ?? this.currentFy();
    const period = await this.runs.ensurePayrollPeriod(companyId, fy);
    return this.prisma.employeeTaxDeclaration.findMany({
      where: { companyId, payrollPeriodId: period.id, isSubmitted: true, ...(status ? { status: status as ApprovalStatus } : {}) },
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, details: { include: { subCategory: true } } }, orderBy: { updatedAt: 'desc' },
    });
  }

  async decide(user: AuthUser, id: string, approve: boolean) {
    const d = await this.prisma.employeeTaxDeclaration.findFirst({ where: { id, companyId: user.companyId } });
    if (!d) throw new NotFoundException('Declaration not found');
    const updated = await this.prisma.employeeTaxDeclaration.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', ...(approve ? {} : { isSubmitted: false }) } });
    await this.notifications.notifyEmployee(d.employeeId, { title: `Tax declaration ${approve ? 'approved' : 'needs changes'}`, message: approve ? 'Your investment declaration was approved' : 'HR rejected your declaration. Please review and resubmit.', type: 'TAX', link: '/ess/dashboard' });
    return updated;
  }

  /** Old vs New regime comparison for the employee's current CTC, using their declared investments. */
  async compareRegimes(user: AuthUser, fyStartYear?: number) {
    const empId = this.access.requireEmployee(user);
    const fy = fyStartYear ?? this.currentFy();
    const fyr = fiscalYearRange(fy);
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: empId } });
    const assignment = await this.profile.assignmentAt(empId, todayIST());
    if (!assignment) throw new BadRequestException('No salary structure assigned yet');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const lines = this.profile.evaluate(assignment.salaryStructure, num(assignment.base), num(assignment.variable), { totalDays: 30, pfApplicable: company.pfEnabled && emp.pfApplicable }).filter((l) => l.type === 'EARNING');
    const taxableAnnual = lines.filter((l) => l.isTaxApplicable).reduce((s, l) => s + l.amount, 0) * 12;
    const pfAnnual = company.pfEnabled && emp.pfApplicable ? calcPF(lines.filter((l) => l.isPfApplicable).reduce((s, l) => s + l.amount, 0), currentPfCeiling()).employeeEpf * 12 : 0;
    const basicDa = lines.filter((l) => l.componentType === 'BASIC' || l.componentType === 'DA').reduce((s, l) => s + l.amount, 0) * 12;
    const hra = lines.filter((l) => l.componentType === 'HRA').reduce((s, l) => s + l.amount, 0) * 12;

    const decl = await this.tax.loadDeclaration(empId, fy);
    const d = decl?.sums || { s80c: 0, s80ccd1b: 0, s80d: 0, homeLoan: 0, other: 0 };
    const age = emp.dateOfBirth ? Math.floor((fyr.end.getTime() - emp.dateOfBirth.getTime()) / (365.25 * 86400000)) : 30;
    const exByCode: Partial<Record<ExemptionCode, number>> = {};
    for (const l of lines) if (l.isTaxApplicable && l.exemptionCode) exByCode[l.exemptionCode as ExemptionCode] = (exByCode[l.exemptionCode as ExemptionCode] ?? 0) + l.amount * 12;
    const exFor = (regime: 'OLD' | 'NEW') => totalAllowanceExemption(exByCode, { months: 12, children: decl?.childrenCount ?? 0, regime, fyStartYear: fy });
    const hraEx = decl ? hraExemption({ hraReceived: hra, basicPlusDa: basicDa, rentPaid: decl.monthlyRent * 12, metro: decl.rentedInMetro }) : 0;

    const oldR = computeTax({ regime: 'OLD', grossAnnualIncome: taxableAnnual - exFor('OLD'), age, deductions: { professionalTax: 2400, section80C: d.s80c + pfAnnual, section80CCD1B: d.s80ccd1b, section80D: d.s80d, homeLoanInterest: d.homeLoan, hraExemption: hraEx, otherChapterVIA: d.other } });
    const newR = computeTax({ regime: 'NEW', grossAnnualIncome: taxableAnnual - exFor('NEW'), age });
    return { fyStartYear: fy, annualTaxableSalary: taxableAnnual, old: oldR, new: newR, recommended: newR.totalTax <= oldR.totalTax ? 'NEW' : 'OLD', saving: Math.abs(oldR.totalTax - newR.totalTax), assumptions: ['Professional tax assumed at ₹2,400/yr under old regime', 'Declared investments (not yet verified) are used for the old regime'] };
  }
}
