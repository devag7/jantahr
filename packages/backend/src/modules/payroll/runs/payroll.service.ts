import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TaxRegime } from '@prisma/client';
import { AuthUser } from '../../../common/types';
import { diffDays, eachDay, isoDate, monthRange, todayIST, addDays } from '../../../common/utils/dates';
import { num, round2 } from '../../../common/utils/money';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalendarService } from '../../calendar/calendar.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { pfCeilingFor } from '../engine/config';
import { codeWages, labourCodesApply } from '../engine/labour-code';
import { calcESI, calcHalfYearlyPT, calcLWF, calcPF, calcPT, esiContributionPeriodStart, ptHalfYear } from '../engine/statutory';
import { EvaluatedLine, PayProfileService } from './pay-profile.service';
import { computeLop, DayRecord } from './payroll-calc';
import { SLIP_INCLUDE, SlipComputation, SlipLine, SlipResult, SlipWithLines } from './payroll.types';
import { TdsService } from '../tax/tds.service';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private profile: PayProfileService,
    private calendar: CalendarService,
    private notifications: NotificationsService,
    private tax: TdsService,
  ) {}

  // ===========================================================================
  // Slip computation (pure w.r.t. persistence)
  // ===========================================================================

  async computeSlip(companyId: string, employeeId: string, year: number, month: number, opts: { treatUnmarkedAsLop?: boolean } = {}): Promise<SlipResult> {
    const { start, end, days: totalDays } = monthRange(year, month);
    const [emp, company] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: employeeId, companyId } }),
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    ]);
    if (!emp) return { ok: false, reason: 'Employee not found' };

    const empStart = emp.dateOfJoining > start ? emp.dateOfJoining : start;
    const empEnd = emp.lastWorkingDate && emp.lastWorkingDate < end ? emp.lastWorkingDate : end;
    if (empStart > empEnd) return { ok: false, reason: 'Not employed during this month' };
    if (emp.status === 'INACTIVE' && !emp.lastWorkingDate) return { ok: false, reason: 'Employee is inactive' };

    const assignments = await this.profile.assignmentsForPeriod(employeeId, empStart, empEnd);
    if (!assignments.length || assignments[0].fromDate > empEnd) return { ok: false, reason: 'No salary structure assigned' };
    const state = emp.professionalTaxState || company.state;
    const warnings: string[] = [];

    // ---- attendance / LOP -------------------------------------------------
    const nw = await this.calendar.nonWorkingDays(companyId, emp.state || state, start, end);
    const [att, leaveTypes] = await Promise.all([
      this.prisma.attendance.findMany({ where: { employeeId, attendanceDate: { gte: empStart, lte: empEnd } } }),
      this.prisma.leaveType.findMany({ where: { companyId }, select: { id: true, isLWP: true, isPaid: true } }),
    ]);
    const unpaid = new Map(leaveTypes.map((t) => [t.id, t.isLWP || !t.isPaid]));
    const records = new Map<string, DayRecord>();
    for (const a of att) {
      records.set(isoDate(a.attendanceDate), {
        status: a.status as DayRecord['status'], leaveKind: a.leaveTypeId ? (unpaid.get(a.leaveTypeId) ? 'UNPAID' : 'PAID') : undefined,
      });
    }
    const window = eachDay(empStart, empEnd);
    const lop = computeLop({ days: window, isNonWorking: nw.isNonWorking, records, treatUnmarkedAsLop: !!opts.treatUnmarkedAsLop, today: todayIST() });
    if (lop.unmarkedWorkingDays) warnings.push(`${lop.unmarkedWorkingDays} working day(s) have no attendance and were treated as paid`);
    const employedDays = window.length;
    const paymentDays = Math.max(0, employedDays - lop.lopDays);
    const totalWorkingDays = eachDay(start, end).filter((d) => !nw.isNonWorking(d)).length;

    // ---- earnings (per assignment segment) ---------------------------------
    const pfApplicable = company.pfEnabled && emp.pfApplicable;
    const byComponent = new Map<string, EvaluatedLine & { earned: number }>();
    let fullMonthTaxableRecurring = 0;
    let fullMonthPfEmployee = 0;
    let fullHra = 0;
    const pfCeiling = pfCeilingFor(year, month);
    let fullBasicDa = 0;
    let fullExempt: Record<string, number> = {};
    let taxRegime: TaxRegime = assignments[0].taxRegime;

    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const segStart = a.fromDate > empStart ? a.fromDate : empStart;
      const segEnd = i + 1 < assignments.length ? addDays(assignments[i + 1].fromDate, -1) : empEnd;
      if (segStart > segEnd) continue;
      const segDays = diffDays(segEnd, segStart) + 1;
      let segLop = 0;
      for (const d of eachDay(segStart, segEnd)) segLop += lop.lopByDay.get(isoDate(d)) || 0;
      const segPay = segDays - segLop;
      taxRegime = a.taxRegime;

      const lines = this.profile.evaluate(a.salaryStructure, num(a.base), num(a.variable), { totalDays, pfApplicable, pfCeiling });
      for (const l of lines.filter((x) => x.type === 'EARNING')) {
        const factor = (l.dependsOnPaymentDays ? segPay : segDays) / totalDays;
        const cur = byComponent.get(l.componentId) || { ...l, earned: 0 };
        cur.earned += l.amount * factor;
        byComponent.set(l.componentId, cur);
      }
      if (i === assignments.length - 1) {
        // last (current) structure drives the forward projection
        const earn = lines.filter((x) => x.type === 'EARNING');
        fullMonthTaxableRecurring = earn.filter((x) => x.isTaxApplicable).reduce((s, x) => s + x.amount, 0);
        fullBasicDa = earn.filter((x) => x.componentType === 'BASIC' || x.componentType === 'DA').reduce((s, x) => s + x.amount, 0);
        fullHra = earn.filter((x) => x.componentType === 'HRA').reduce((s, x) => s + x.amount, 0);
        fullExempt = {};
        for (const x of earn) if (x.exemptionCode && x.isTaxApplicable) fullExempt[x.exemptionCode] = (fullExempt[x.exemptionCode] ?? 0) + x.amount;
        fullMonthPfEmployee = pfApplicable ? calcPF(earn.filter((x) => x.isPfApplicable).reduce((s, x) => s + x.amount, 0), pfCeiling).employeeEpf : 0;
      }
    }

    const earnings: SlipLine[] = [];
    let taxableEarnings = 0;
    let pfWagesActual = 0;
    let esiWages = 0;
    let ptWages = 0;
    let basicEarned = 0;
    let basicDaEarned = 0;
    const exemptNow: Record<string, number> = {};
    let recurringGross = 0;
    for (const l of byComponent.values()) {
      const amount = Math.round(l.earned);
      if (amount <= 0) continue;
      earnings.push({ componentId: l.componentId, abbr: l.abbr, name: l.name, amount });
      if (l.isTaxApplicable) taxableEarnings += amount;
      if (l.isTaxApplicable && l.exemptionCode) exemptNow[l.exemptionCode] = (exemptNow[l.exemptionCode] ?? 0) + amount;
      if (l.isPfApplicable) pfWagesActual += amount;
      if (l.isEsiApplicable) esiWages += amount;
      if (l.isPtApplicable) ptWages += amount;
      if (l.componentType === 'BASIC') basicEarned += amount;
      if (l.componentType === 'BASIC' || l.componentType === 'DA') basicDaEarned += amount;
      recurringGross += amount;
    }

    // Labour codes (from 21-Nov-2025): wages for PF / gratuity are at least 50% of remuneration
    // remuneration for the 50% test includes the employer's PF share (MoLE FAQ, Mar-2026) but not gratuity or ESI
    const erPf = pfApplicable ? calcPF(pfWagesActual, pfCeiling).employerTotal : 0;
    const cw = company.labourCodeWages && labourCodesApply(end) ? codeWages(basicDaEarned, recurringGross + erPf) : null;
    if (cw && pfApplicable && cw.wages > pfWagesActual) {
      warnings.push(`Labour-code wage rule: PF wages raised from ₹${pfWagesActual} to ₹${cw.wages} (allowances exceeded 50% of remuneration)`);
      pfWagesActual = cw.wages;
    }

    // ---- additional salary & reimbursements -------------------------------
    const addl = await this.prisma.additionalSalary.findMany({
      where: {
        employeeId, companyId,
        OR: [{ payrollDate: { gte: start, lte: end } }, { isRecurring: true, fromDate: { lte: end }, toDate: { gte: start } }],
      },
      include: { salaryComponent: true },
    });
    const addlDeductions: SlipLine[] = [];
    for (const s of addl) {
      const amount = Math.round(num(s.amount));
      if (amount <= 0) continue;
      const line = { componentId: s.salaryComponentId, abbr: s.salaryComponent.abbr, name: s.reason ? `${s.salaryComponent.name} (${s.reason})`.slice(0, 100) : s.salaryComponent.name, amount };
      if (s.type === 'EARNING') {
        earnings.push(line);
        if (s.salaryComponent.isTaxApplicable) taxableEarnings += amount;
        if (s.salaryComponent.isTaxApplicable && s.salaryComponent.exemptionCode) exemptNow[s.salaryComponent.exemptionCode] = (exemptNow[s.salaryComponent.exemptionCode] ?? 0) + amount;
        if (s.salaryComponent.isEsiApplicable) esiWages += amount;
        if (s.salaryComponent.isPtApplicable) ptWages += amount;
      } else addlDeductions.push(line);
    }
    const reimb = await this.prisma.salaryComponent.findFirst({ where: { companyId, abbr: 'REIMB' } });
    if (reimb) {
      const claims = await this.prisma.expenseClaim.aggregate({ where: { employeeId, companyId, status: 'APPROVED' }, _sum: { totalApproved: true } });
      const amount = Math.round(num(claims._sum.totalApproved));
      if (amount > 0) earnings.push({ componentId: reimb.id, abbr: 'REIMB', name: reimb.name, amount });
    }

    const grossPay = earnings.reduce((s, l) => s + l.amount, 0);
    if (grossPay <= 0) return { ok: false, reason: paymentDays <= 0 ? 'Zero payable days (full loss of pay)' : 'Zero earnings' };

    // ---- statutory --------------------------------------------------------
    const comps = await this.prisma.salaryComponent.findMany({ where: { companyId, isStatutory: true } });
    const compId = (abbr: string) => comps.find((c) => c.abbr === abbr)?.id;

    const pf = pfApplicable ? calcPF(pfWagesActual, pfCeiling) : calcPF(0, pfCeiling);
    const esiEligible = company.esiEnabled && emp.esiApplicable;
    // ESI: an employee covered earlier in this Apr–Sep / Oct–Mar contribution period stays covered until it ends
    let esiStayCovered = false;
    if (esiEligible && esiWages > 21000) {
      const earlier = await this.prisma.salarySlip.findFirst({
        where: { employeeId, status: { not: 'CANCELLED' }, startDate: { gte: esiContributionPeriodStart(year, month), lt: start }, esiEmployee: { gt: 0 } }, select: { id: true },
      });
      esiStayCovered = !!earlier;
      if (esiStayCovered) warnings.push('ESI continues to the end of the contribution period although wages crossed ₹21,000');
    }
    const esi = esiEligible ? calcESI(esiWages, esiStayCovered) : calcESI(0);

    let pt = 0;
    if (company.ptEnabled && emp.ptApplicable && state) {
      const versions = await this.prisma.professionalTaxSlab.findMany({ where: { state, effectiveFrom: { lte: end }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }] } });
      const latestFrom = Math.max(0, ...versions.map((v) => v.effectiveFrom.getTime()));
      const slabs = versions.filter((v) => v.effectiveFrom.getTime() === latestFrom);
      const rows = slabs.map((s) => ({ fromSalary: num(s.fromSalary), toSalary: num(s.toSalary), taxAmount: num(s.taxAmount), februaryAmount: s.februaryAmount === null ? null : num(s.februaryAmount), gender: s.gender }));
      const half = slabs.find((s) => s.frequency === 'HALF_YEARLY');
      if (half) {
        const months = (half.deductionMonths ?? '9,3').split(',').map((m) => parseInt(m, 10));
        if (months.includes(month)) {
          const h = ptHalfYear(year, month);
          const earlier = await this.prisma.salarySlip.aggregate({ where: { employeeId, status: { not: 'CANCELLED' }, startDate: { gte: h.start, lt: start } }, _sum: { grossPay: true } });
          const halfGross = num(earlier._sum.grossPay) + ptWages + h.monthsLeft * ptWages;
          pt = calcHalfYearlyPT(rows, halfGross, month, months);
          if (pt) warnings.push(`Half-yearly professional tax (${state}) on half-year gross ₹${Math.round(halfGross)}`);
        }
      } else pt = calcPT(rows, ptWages, month, emp.gender);
    }
    let lwf = { employee: 0, employer: 0 };
    if (company.lwfEnabled && state) {
      const rate = await this.prisma.lwfRate.findFirst({ where: { state, effectiveFrom: { lte: end } }, orderBy: { effectiveFrom: 'desc' } });
      lwf = calcLWF(rate ? { employeeAmount: num(rate.employeeAmount), employerAmount: num(rate.employerAmount), months: rate.months } : undefined, month);
    }

    // ---- loans ------------------------------------------------------------
    const loans = await this.prisma.employeeLoan.findMany({ where: { employeeId, status: 'ACTIVE', startDate: { lte: end } } });
    let loanDeduction = 0;
    for (const l of loans) loanDeduction += Math.min(num(l.emi), num(l.outstanding));
    loanDeduction = Math.round(loanDeduction);

    // ---- TDS --------------------------------------------------------------
    const tdsCalc = await this.tax.computeTds({
      emp, taxRegime, year, month, start, currentTaxable: taxableEarnings, currentPf: pf.employeeEpf, currentPt: pt,
      fullMonthTaxableRecurring, fullMonthPfEmployee, fullHra, fullBasicDa, employedFromDate: empStart, employedToDate: empEnd, exemptNow, fullExempt,
    });

    const nonTdsDeductions = pf.employeeEpf + esi.employee + pt + lwf.employee + loanDeduction + addlDeductions.reduce((s, l) => s + l.amount, 0);
    let tds = tdsCalc.tds;
    const room = Math.max(0, grossPay - nonTdsDeductions);
    if (tds > room) {
      warnings.push(`TDS limited to available net pay (₹${tds} computed, ₹${room} deducted); shortfall carries to later months`);
      tds = room;
    }

    const deductions: SlipLine[] = [];
    const push = (abbr: string, amount: number) => {
      const id = compId(abbr);
      if (amount > 0 && id) deductions.push({ componentId: id, abbr, name: comps.find((c) => c.abbr === abbr)!.name, amount });
    };
    push('PF', pf.employeeEpf);
    push('ESI', esi.employee);
    push('PT', pt);
    push('LWF', lwf.employee);
    push('TDS', tds);
    if (loanDeduction > 0) {
      const id = (await this.prisma.salaryComponent.findFirst({ where: { companyId, abbr: 'LOAN' } }))?.id;
      if (id) deductions.push({ componentId: id, abbr: 'LOAN', name: 'Loan / Advance Recovery', amount: loanDeduction });
    }
    deductions.push(...addlDeductions);

    const totalDeductions = deductions.reduce((s, l) => s + l.amount, 0);
    const netPay = grossPay - totalDeductions;
    if (netPay < 0) warnings.push('Net pay is negative: review deductions');
    if (esiEligible && !esi.applicable && esi.reason === 'Wages exceed ₹21,000 ceiling') { /* informational only */ }
    if (pfApplicable && pf.applicable && !emp.uanNumber) warnings.push('UAN missing: required for ECR filing');

    return {
      ok: true,
      slip: {
        employeeId, companyId, month, year, start, end, totalDays, totalWorkingDays, paymentDays: round2(paymentDays), absentDays: round2(lop.absentDays), lopDays: round2(lop.lopDays),
        earnings, deductions, grossPay, taxableEarnings, totalDeductions, netPay, taxRegime,
        pfWages: pf.pfWages, pfEmployee: pf.employeeEpf, pfEmployerEpf: pf.employerEpf, pfEmployerEps: pf.employerEps, pfEdli: pf.edli, pfAdmin: pf.adminCharges,
        esiEmployee: esi.employee, esiEmployer: esi.employer, professionalTax: pt, lwfEmployee: lwf.employee, lwfEmployer: lwf.employer, tds, loanDeduction,
        gratuityProvision: Math.round((cw ? cw.wages : basicEarned) * 0.0481), warnings, taxProjection: tdsCalc.projection,
      },
    };
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  async persistSlip(c: SlipComputation, payrollEntryId?: string | null) {
    const existing = await this.prisma.salarySlip.findUnique({ where: { employeeId_year_month: { employeeId: c.employeeId, year: c.year, month: c.month } } });
    if (existing && (existing.status === 'APPROVED' || existing.status === 'PAID')) throw new BadRequestException('This salary slip is already approved; reopen the payroll run to change it');
    const data = {
      companyId: c.companyId, startDate: c.start, endDate: c.end, month: c.month, year: c.year, payrollEntryId: payrollEntryId ?? null,
      totalWorkingDays: c.totalWorkingDays, paymentDays: c.paymentDays, absentDays: c.absentDays, leaveWithoutPay: c.lopDays - c.absentDays,
      grossPay: c.grossPay, totalEarnings: c.grossPay, totalDeductions: c.totalDeductions, netPay: c.netPay, roundedTotal: Math.round(c.netPay), taxableEarnings: c.taxableEarnings,
      taxRegime: c.taxRegime, pfWages: c.pfWages, pfEmployee: c.pfEmployee, pfEmployerEpf: c.pfEmployerEpf, pfEmployerEps: c.pfEmployerEps, pfEdli: c.pfEdli, pfAdmin: c.pfAdmin,
      esiEmployee: c.esiEmployee, esiEmployer: c.esiEmployer, professionalTax: c.professionalTax, lwfEmployee: c.lwfEmployee, lwfEmployer: c.lwfEmployer, tds: c.tds,
      loanDeduction: c.loanDeduction, gratuityProvision: c.gratuityProvision, status: 'GENERATED' as const, remarks: c.warnings.join(' | ') || null, postingDate: new Date(),
    };
    return this.prisma.$transaction(async (tx) => {
      let slip;
      if (existing) {
        await tx.salarySlipEarning.deleteMany({ where: { salarySlipId: existing.id } });
        await tx.salarySlipDeduction.deleteMany({ where: { salarySlipId: existing.id } });
        slip = await tx.salarySlip.update({ where: { id: existing.id }, data });
      } else slip = await tx.salarySlip.create({ data: { ...data, employeeId: c.employeeId } });
      await tx.salarySlipEarning.createMany({ data: c.earnings.map((l) => ({ salarySlipId: slip.id, salaryComponentId: l.componentId, amount: l.amount })) });
      await tx.salarySlipDeduction.createMany({ data: c.deductions.map((l) => ({ salarySlipId: slip.id, salaryComponentId: l.componentId, amount: l.amount })) });
      return slip;
    });
  }

  // ===========================================================================
  // Views
  // ===========================================================================

  slipView(s: SlipWithLines) {
    return {
      id: s.id, employeeId: s.employeeId, employee: s.employee && { id: s.employee.id, employeeCode: s.employee.employeeCode, name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), department: s.employee.department?.name, designation: s.employee.designation?.name },
      month: s.month, year: s.year, startDate: s.startDate, endDate: s.endDate, status: s.status, totalWorkingDays: s.totalWorkingDays, paymentDays: num(s.paymentDays), absentDays: num(s.absentDays), leaveWithoutPay: num(s.leaveWithoutPay),
      grossPay: num(s.grossPay), totalDeductions: num(s.totalDeductions), netPay: num(s.netPay), roundedTotal: num(s.roundedTotal), taxRegime: s.taxRegime,
      pfEmployee: num(s.pfEmployee), esiEmployee: num(s.esiEmployee), professionalTax: num(s.professionalTax), tds: num(s.tds), loanDeduction: num(s.loanDeduction),
      employerContribution: num(s.pfEmployerEpf) + num(s.pfEmployerEps) + num(s.pfEdli) + num(s.pfAdmin) + num(s.esiEmployer) + num(s.lwfEmployer), remarks: s.remarks, paidAt: s.paidAt,
      earnings: (s.earnings || []).map((e) => ({ name: e.salaryComponent.name, abbr: e.salaryComponent.abbr, amount: num(e.amount) })),
      deductions: (s.deductions || []).map((e) => ({ name: e.salaryComponent.name, abbr: e.salaryComponent.abbr, amount: num(e.amount) })),
    };
  }

  /** What-if / pre-run preview for a single employee (not persisted). */
  async preview(user: AuthUser, employeeId: string, month: number, year: number, treatUnmarkedAsLop = false) {
    const res = await this.computeSlip(user.companyId, employeeId, year, month, { treatUnmarkedAsLop });
    if (!res.ok) throw new BadRequestException(res.reason);
    const s = res.slip;
    return { ...s, start: undefined, end: undefined };
  }

  async mySlips(user: AuthUser) {
    if (!user.employeeId) throw new ForbiddenException('No employee profile');
    const slips = await this.prisma.salarySlip.findMany({ where: { employeeId: user.employeeId, status: { in: ['APPROVED', 'PAID'] } }, include: SLIP_INCLUDE, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 36 });
    return slips.map((s) => this.slipView(s));
  }

  async slipsForEmployee(companyId: string, employeeId: string) {
    const slips = await this.prisma.salarySlip.findMany({ where: { employeeId, companyId }, include: SLIP_INCLUDE, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 36 });
    return slips.map((s) => this.slipView(s));
  }

  async getSlipForUser(user: AuthUser, id: string) {
    const s = await this.prisma.salarySlip.findFirst({ where: { id, companyId: user.companyId }, include: SLIP_INCLUDE });
    if (!s) throw new NotFoundException('Salary slip not found');
    const isSelf = s.employeeId === user.employeeId;
    const isPayroll = ['SUPER_ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN'].includes(user.role);
    if (!isPayroll && !(isSelf && ['APPROVED', 'PAID'].includes(s.status))) throw new ForbiddenException('You cannot view this salary slip');
    return s;
  }
}
