import { Injectable } from '@nestjs/common';
import { TaxRegime } from '@prisma/client';
import { fiscalYearRange, fiscalYearStartYear } from '../../../common/utils/dates';
import { num } from '../../../common/utils/money';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExemptionCode, totalAllowanceExemption } from '../engine/allowances';
import { computeTax, hraExemption, NEW_REGIME, oldRegimeConfig, RegimeConfig } from '../engine/tax';
import { monthsRemainingInFY } from '../runs/payroll-calc';

/**
 * Monthly TDS on salary: projects the year's taxable income (year to date + this month + remaining months), applies the
 * employee's regime, declarations, HRA and allowance exemptions, and spreads the tax still due over the remaining months.
 */
@Injectable()
export class TdsService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // TDS: annual projection, less tax already deducted, spread over remaining months
  // ---------------------------------------------------------------------------
  async computeTds(p: {
    emp: { id: string; dateOfBirth: Date | null; gender: string; dateOfJoining: Date; lastWorkingDate: Date | null };
    taxRegime: TaxRegime; year: number; month: number; start: Date; currentTaxable: number; currentPf: number; currentPt: number;
    fullMonthTaxableRecurring: number; fullMonthPfEmployee: number; fullHra: number; fullBasicDa: number; employedFromDate: Date; employedToDate: Date;
    exemptNow: Record<string, number>; fullExempt: Record<string, number>;
  }): Promise<{ tds: number; projection: Record<string, number> }> {
    const fyStartYear = fiscalYearStartYear(p.start);
    const fy = fiscalYearRange(fyStartYear);
    const monthsRemaining = monthsRemainingInFY(p.month);
    let futureMonths = monthsRemaining - 1;
    if (p.emp.lastWorkingDate && p.emp.lastWorkingDate < fy.end) {
      const lwd = p.emp.lastWorkingDate;
      const lwdIdx = (lwd.getUTCFullYear() - p.start.getUTCFullYear()) * 12 + (lwd.getUTCMonth() - p.start.getUTCMonth());
      futureMonths = Math.max(0, Math.min(futureMonths, lwdIdx));
    }
    const monthsFromNow = futureMonths + 1;

    const prev = await this.prisma.salarySlip.findMany({
      where: { employeeId: p.emp.id, status: { not: 'CANCELLED' }, startDate: { gte: fy.start, lt: p.start } },
      select: { taxableEarnings: true, pfEmployee: true, professionalTax: true, tds: true },
    });
    const ytd = prev.reduce((a, s) => ({ taxable: a.taxable + num(s.taxableEarnings), pf: a.pf + num(s.pfEmployee), pt: a.pt + num(s.professionalTax), tds: a.tds + num(s.tds) }), { taxable: 0, pf: 0, pt: 0, tds: 0 });

    const declaration = await this.loadDeclaration(p.emp.id, fyStartYear);
    const regime: TaxRegime = declaration?.isSubmitted ? declaration.taxRegime : p.taxRegime;

    const projectedTaxable = ytd.taxable + p.currentTaxable + futureMonths * p.fullMonthTaxableRecurring;
    const projPf = ytd.pf + p.currentPf + futureMonths * p.fullMonthPfEmployee;
    const projPt = ytd.pt + p.currentPt + futureMonths * p.currentPt;

    // allowances exempt up to a limit (children education, hostel, meal vouchers)
    const ytdEx = await this.prisma.salarySlipEarning.findMany({
      where: { salarySlip: { employeeId: p.emp.id, status: { not: 'CANCELLED' }, startDate: { gte: fy.start, lt: p.start } }, salaryComponent: { exemptionCode: { not: null }, isTaxApplicable: true } },
      select: { amount: true, salaryComponent: { select: { exemptionCode: true } } },
    });
    const exByCode: Partial<Record<ExemptionCode, number>> = {};
    const addEx = (code: string, amt: number) => { exByCode[code as ExemptionCode] = (exByCode[code as ExemptionCode] ?? 0) + amt; };
    for (const e of ytdEx) addEx(e.salaryComponent.exemptionCode!, num(e.amount));
    for (const [c, v] of Object.entries(p.exemptNow)) addEx(c, v);
    for (const [c, v] of Object.entries(p.fullExempt)) addEx(c, v * futureMonths);

    const age = p.emp.dateOfBirth ? Math.floor((fy.end.getTime() - p.emp.dateOfBirth.getTime()) / (365.25 * 86400000)) : 30;
    const cfg = await this.regimeConfig(regime, fy.start, age);

    let deductions: Parameters<typeof computeTax>[0]['deductions'] = {};
    if (regime === 'OLD') {
      const d = declaration?.sums || { s80c: 0, s80ccd1b: 0, s80d: 0, homeLoan: 0, other: 0 };
      const employedMonths = Math.max(1, Math.min(12, (fy.end.getUTCFullYear() - p.employedFromDate.getUTCFullYear()) * 12 + (fy.end.getUTCMonth() - p.employedFromDate.getUTCMonth()) + 1));
      const months = p.employedFromDate < fy.start ? 12 : employedMonths;
      const hra = declaration ? hraExemption({
        hraReceived: p.fullHra * months, basicPlusDa: p.fullBasicDa * months, rentPaid: declaration.monthlyRent * months, metro: declaration.rentedInMetro,
      }) : 0;
      deductions = { professionalTax: projPt, section80C: d.s80c + projPf, section80CCD1B: d.s80ccd1b, section80D: d.s80d, homeLoanInterest: d.homeLoan, hraExemption: hra, otherChapterVIA: d.other };
    }
    const exemptMonths = Math.min(12, prev.length + 1 + futureMonths);
    const allowanceEx = Math.round(totalAllowanceExemption(exByCode, { months: exemptMonths, children: declaration?.childrenCount ?? 0, regime, fyStartYear: fyStartYear }));
    const result = computeTax({ regime, grossAnnualIncome: Math.max(0, projectedTaxable - allowanceEx), age, deductions, config: cfg });
    const monthly = Math.max(0, Math.round((result.totalTax - ytd.tds) / monthsFromNow));
    return {
      tds: monthly,
      projection: { fy: fyStartYear, monthsRemaining: monthsFromNow, projectedTaxableEarnings: Math.round(projectedTaxable), allowanceExemption: allowanceEx, taxableIncome: result.taxableIncome, annualTax: result.totalTax, tdsDeductedYtd: Math.round(ytd.tds), regimeIsNew: regime === 'NEW' ? 1 : 0 },
    };
  }

  async loadDeclaration(employeeId: string, fyStartYear: number) {
    const fy = fiscalYearRange(fyStartYear);
    const dec = await this.prisma.employeeTaxDeclaration.findFirst({
      where: { employeeId, status: { not: 'REJECTED' }, isSubmitted: true },
      include: { details: { include: { subCategory: { include: { category: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!dec) return null;
    // declarations are keyed by payroll period; match FY via period dates
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id: dec.payrollPeriodId } });
    if (!period || period.startDate.getTime() !== fy.start.getTime()) return null;
    const bySection = new Map<string, number>();
    for (const d of dec.details) {
      const amt = Math.min(num(d.declaredAmount), num(d.subCategory.maxAmount));
      const sec = d.subCategory.category.section;
      bySection.set(sec, Math.min((bySection.get(sec) || 0) + amt, num(d.subCategory.category.maxAmount)));
    }
    const other = ['80E', '80G', '80TTA'].reduce((s, k) => s + (bySection.get(k) || 0), 0);
    const homeLoan = Math.max(num(dec.homeLoanInterest), bySection.get('24(b)') || 0);
    return {
      taxRegime: dec.taxRegime, isSubmitted: dec.isSubmitted, monthlyRent: num(dec.monthlyRent), rentedInMetro: dec.rentedInMetro, childrenCount: dec.childrenCount,
      sums: { s80c: bySection.get('80C') || 0, s80ccd1b: bySection.get('80CCD(1B)') || 0, s80d: bySection.get('80D') || 0, homeLoan, other },
    };
  }

  /** DB slab tables (per company or global) override built-in defaults; rebate max stays code-defined. */
  async regimeConfig(regime: TaxRegime, fyStart: Date, age: number): Promise<RegimeConfig> {
    const base = regime === 'NEW' ? NEW_REGIME : oldRegimeConfig(age);
    const row = await this.prisma.incomeTaxSlab.findFirst({ where: { taxRegime: regime, effectiveFrom: { lte: fyStart } }, orderBy: { effectiveFrom: 'desc' }, include: { slabs: { orderBy: { fromAmount: 'asc' } } } });
    if (!row || !row.slabs.length) return base;
    if (regime === 'OLD' && age >= 60) return base; // senior-citizen exemption is age-driven
    return {
      ...base,
      slabs: row.slabs.map((s) => ({ from: num(s.fromAmount), to: num(s.toAmount) >= 1e12 ? Infinity : num(s.toAmount), rate: num(s.taxPercent) })),
      standardDeduction: num(row.standardDeduction), rebateLimit: row.taxReliefLimit ? num(row.taxReliefLimit) : base.rebateLimit,
    };
  }
}
