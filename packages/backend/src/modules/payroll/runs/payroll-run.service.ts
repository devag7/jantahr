import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../common/types';
import { addDays, fiscalYearRange, fiscalYearStartYear, monthRange } from '../../../common/utils/dates';
import { num, round2 } from '../../../common/utils/money';
import { PrismaService } from '../../../prisma/prisma.service';
import { PayrollService } from './payroll.service';
import { SLIP_INCLUDE } from './payroll.types';

import { errorMessage } from '../../../common/utils/errors';
/** The monthly run: create → generate slips → approve (locks slips, notifies employees) → paid, with reopen and delete. */
@Injectable()
export class PayrollRunService {
  private readonly logger = new Logger(PayrollRunService.name);

  constructor(private prisma: PrismaService, private payroll: PayrollService) {}


  private async getRun(companyId: string, id: string) {
    const run = await this.prisma.payrollEntry.findFirst({ where: { id, companyId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async listRuns(companyId: string) {
    return this.prisma.payrollEntry.findMany({ where: { companyId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
  }

  async getRunDetail(companyId: string, id: string) {
    const run = await this.getRun(companyId, id);
    const slips = await this.prisma.salarySlip.findMany({ where: { payrollEntryId: id }, include: SLIP_INCLUDE, orderBy: { employee: { employeeCode: 'asc' } } });
    return { ...run, slips: slips.map((s) => this.payroll.slipView(s)) };
  }

  async createRun(user: AuthUser, month: number, year: number, opts: { departmentId?: string; treatUnmarkedAsLop?: boolean }) {
    if (month < 1 || month > 12) throw new BadRequestException('Invalid month');
    const existing = await this.prisma.payrollEntry.findUnique({ where: { companyId_month_year: { companyId: user.companyId, month, year } } });
    if (existing) {
      if (existing.status === 'APPROVED' || existing.status === 'PAID') throw new BadRequestException(`Payroll for ${month}/${year} is already ${existing.status.toLowerCase()}`);
      return this.generate(user, existing.id, opts.treatUnmarkedAsLop);
    }
    const { start, end } = monthRange(year, month);
    const run = await this.prisma.payrollEntry.create({
      data: {
        companyId: user.companyId, month, year, startDate: start, endDate: end, payrollFrequency: 'MONTHLY', departmentId: opts.departmentId,
        payrollPeriodId: (await this.ensurePayrollPeriod(user.companyId, fiscalYearStartYear(start))).id, processedBy: user.userId, treatUnmarkedAsLop: !!opts.treatUnmarkedAsLop,
      },
    });
    return this.generate(user, run.id, opts.treatUnmarkedAsLop);
  }

  async ensurePayrollPeriod(companyId: string, fyStartYear: number) {
    const fy = fiscalYearRange(fyStartYear);
    const found = await this.prisma.payrollPeriod.findFirst({ where: { companyId, startDate: fy.start } });
    if (found) return found;
    return this.prisma.payrollPeriod.create({ data: { companyId, name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`, startDate: fy.start, endDate: fy.end } });
  }

  async generate(user: AuthUser, runId: string, treatUnmarkedAsLop?: boolean) {
    const run = await this.getRun(user.companyId, runId);
    if (run.status === 'APPROVED' || run.status === 'PAID') throw new BadRequestException('Approved payroll cannot be regenerated');
    const lopFlag = treatUnmarkedAsLop ?? run.treatUnmarkedAsLop;
    const emps = await this.prisma.employee.findMany({
      where: {
        companyId: user.companyId, dateOfJoining: { lte: run.endDate }, OR: [{ lastWorkingDate: null }, { lastWorkingDate: { gte: run.startDate } }],
        status: { in: ['ACTIVE', 'SUSPENDED', 'LEFT'] }, ...(run.departmentId ? { departmentId: run.departmentId } : {}),
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, status: true, lastWorkingDate: true },
    });

    const skipped: { employeeId: string; employeeCode: string; name: string; reason: string }[] = [];
    let generated = 0;
    for (const e of emps) {
      if (e.status === 'LEFT' && !e.lastWorkingDate) continue;
      try {
        const res = await this.payroll.computeSlip(user.companyId, e.id, run.year, run.month, { treatUnmarkedAsLop: lopFlag });
        if (!res.ok) { skipped.push({ employeeId: e.id, employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), reason: res.reason }); continue; }
        await this.payroll.persistSlip(res.slip, run.id);
        generated++;
      } catch (err) {
        this.logger.warn(`slip failed for ${e.employeeCode}: ${errorMessage(err)}`);
        skipped.push({ employeeId: e.id, employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), reason: errorMessage(err) });
      }
    }
    const keepIds = (await this.prisma.salarySlip.findMany({ where: { payrollEntryId: run.id }, select: { id: true } })).map((s) => s.id);
    const totals = await this.prisma.salarySlip.aggregate({
      where: { payrollEntryId: run.id }, _sum: { grossPay: true, totalDeductions: true, netPay: true, pfEmployerEpf: true, pfEmployerEps: true, pfEdli: true, pfAdmin: true, esiEmployer: true, lwfEmployer: true }, _count: true,
    });
    const employer = (['pfEmployerEpf', 'pfEmployerEps', 'pfEdli', 'pfAdmin', 'esiEmployer', 'lwfEmployer'] as const).reduce((s, k) => s + num(totals._sum[k]), 0);
    await this.prisma.payrollEntry.update({
      where: { id: run.id },
      data: { status: 'GENERATED', employeeCount: keepIds.length, totalGross: num(totals._sum.grossPay), totalDeductions: num(totals._sum.totalDeductions), totalNet: num(totals._sum.netPay), totalEmployerContribution: employer, treatUnmarkedAsLop: !!lopFlag, processedBy: user.userId, processedAt: new Date() },
    });
    return { run: await this.getRun(user.companyId, run.id), generated, skipped };
  }

  async approve(user: AuthUser, runId: string) {
    const run = await this.getRun(user.companyId, runId);
    if (run.status !== 'GENERATED') throw new BadRequestException(`Only a generated payroll can be approved (current: ${run.status})`);
    const slips = await this.prisma.salarySlip.findMany({ where: { payrollEntryId: runId } });
    if (!slips.length) throw new BadRequestException('Payroll run has no salary slips');
    if (slips.some((s) => num(s.netPay) < 0)) throw new BadRequestException('Resolve negative net pay slips before approving');

    await this.prisma.$transaction(async (tx) => {
      await tx.salarySlip.updateMany({ where: { payrollEntryId: runId }, data: { status: 'APPROVED' } });
      await tx.payrollEntry.update({ where: { id: runId }, data: { status: 'APPROVED' } });
      for (const s of slips) {
        // advance loan schedules
        const loans = await tx.employeeLoan.findMany({ where: { employeeId: s.employeeId, status: 'ACTIVE', startDate: { lte: s.endDate } } });
        for (const l of loans) {
          const emi = Math.min(num(l.emi), num(l.outstanding));
          const outstanding = round2(num(l.outstanding) - emi);
          const paid = l.paidInstallments + 1;
          await tx.employeeLoan.update({ where: { id: l.id }, data: { outstanding, paidInstallments: paid, status: outstanding <= 0 || paid >= l.totalInstallments ? 'CLOSED' : 'ACTIVE' } });
        }
        // reimbursed expense claims
        await tx.expenseClaim.updateMany({ where: { employeeId: s.employeeId, status: 'APPROVED', updatedAt: { lte: s.updatedAt } }, data: { status: 'REIMBURSED', reimbursedAt: new Date() } });
      }
    });
    const users = await this.prisma.employee.findMany({ where: { id: { in: slips.map((s) => s.employeeId) } }, select: { userId: true } });
    await this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.userId, title: 'Payslip available', message: `Your payslip for ${String(run.month).padStart(2, '0')}/${run.year} is ready`, type: 'PAYROLL', link: '/ess/dashboard' })),
    });
    return this.getRun(user.companyId, runId);
  }

  async markPaid(user: AuthUser, runId: string) {
    const run = await this.getRun(user.companyId, runId);
    if (run.status !== 'APPROVED') throw new BadRequestException('Only an approved payroll can be marked as paid');
    await this.prisma.$transaction([
      this.prisma.salarySlip.updateMany({ where: { payrollEntryId: runId }, data: { status: 'PAID', paidAt: new Date() } }),
      this.prisma.payrollEntry.update({ where: { id: runId }, data: { status: 'PAID' } }),
    ]);
    return this.getRun(user.companyId, runId);
  }

  /** Reverse an approved (not yet paid) run so figures can be corrected. */
  async reopen(user: AuthUser, runId: string) {
    const run = await this.getRun(user.companyId, runId);
    if (run.status !== 'APPROVED') throw new BadRequestException('Only an approved (unpaid) payroll can be reopened');
    const slips = await this.prisma.salarySlip.findMany({ where: { payrollEntryId: runId } });
    await this.prisma.$transaction(async (tx) => {
      for (const s of slips) {
        const loans = await tx.employeeLoan.findMany({ where: { employeeId: s.employeeId, paidInstallments: { gt: 0 }, startDate: { lte: s.endDate } } });
        for (const l of loans) {
          const emi = num(l.emi);
          await tx.employeeLoan.update({ where: { id: l.id }, data: { outstanding: round2(Math.min(num(l.principal), num(l.outstanding) + emi)), paidInstallments: l.paidInstallments - 1, status: 'ACTIVE' } });
        }
        await tx.expenseClaim.updateMany({ where: { employeeId: s.employeeId, status: 'REIMBURSED', reimbursedAt: { gte: addDays(new Date(), -1) } }, data: { status: 'APPROVED', reimbursedAt: null } });
      }
      await tx.salarySlip.updateMany({ where: { payrollEntryId: runId }, data: { status: 'GENERATED' } });
      await tx.payrollEntry.update({ where: { id: runId }, data: { status: 'GENERATED' } });
    });
    return this.getRun(user.companyId, runId);
  }

  async deleteRun(user: AuthUser, runId: string) {
    const run = await this.getRun(user.companyId, runId);
    if (run.status === 'APPROVED' || run.status === 'PAID') throw new BadRequestException('Approved payroll cannot be deleted');
    await this.prisma.$transaction([
      this.prisma.salarySlip.deleteMany({ where: { payrollEntryId: runId } }),
      this.prisma.payrollEntry.delete({ where: { id: runId } }),
    ]);
    return { ok: true };
  }
}
