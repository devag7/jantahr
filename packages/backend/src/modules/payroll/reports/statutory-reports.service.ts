import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { AuthUser } from '../../../common/types';
import { toCsv } from '../../../common/utils/csv';
import { fiscalYearLabel, fiscalYearRange, isoDate } from '../../../common/utils/dates';
import { num } from '../../../common/utils/money';
import { PrismaService } from '../../../prisma/prisma.service';
import { computeTax, hraExemption } from '../engine/tax';
import { PdfService } from './pdf.service';
import { PayrollService } from '../runs/payroll.service';
import { TdsService } from '../tax/tds.service';

import { PayrollStatus } from '@prisma/client';
const DONE = ['GENERATED', 'APPROVED', 'PAID'] as const;

@Injectable()
export class StatutoryReportsService {
  constructor(private prisma: PrismaService, private crypto: CryptoService, private pdf: PdfService, private payroll: PayrollService, private tax: TdsService) {}

  private slips(companyId: string, month: number, year: number, statuses: readonly string[] = DONE) {
    return this.prisma.salarySlip.findMany({
      where: { companyId, month, year, status: { in: statuses as PayrollStatus[] } },
      include: { employee: true, earnings: { include: { salaryComponent: true } }, deductions: { include: { salaryComponent: true } } },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
  }

  /** EPFO ECR text file (v2 layout, #~# separated). */
  async ecr(companyId: string, month: number, year: number) {
    const slips = (await this.slips(companyId, month, year)).filter((s) => num(s.pfEmployee) > 0 || num(s.pfWages) > 0);
    const warnings: string[] = [];
    const rows = slips.map((s) => {
      if (!s.employee.uanNumber) warnings.push(`${s.employee.employeeCode} ${s.employee.firstName}: UAN missing`);
      const gross = Math.round(num(s.grossPay));
      const wages = Math.round(num(s.pfWages));
      const eps = Math.round(num(s.pfEmployerEps));
      const epfEr = Math.round(num(s.pfEmployerEpf));
      const ncp = Math.round(num(s.leaveWithoutPay) + num(s.absentDays));
      return {
        uan: s.employee.uanNumber || '', name: `${s.employee.firstName} ${s.employee.lastName}`.trim().toUpperCase(), gross, epfWages: wages, epsWages: wages, edliWages: wages,
        epfEe: Math.round(num(s.pfEmployee)), epsEr: eps, epfEpsDiff: epfEr, ncpDays: ncp, refund: 0,
      };
    });
    const text = rows.map((r) => [r.uan, r.name, r.gross, r.epfWages, r.epsWages, r.edliWages, r.epfEe, r.epsEr, r.epfEpsDiff, r.ncpDays, r.refund].join('#~#')).join('\n');
    const totals = rows.reduce((t, r) => ({ wages: t.wages + r.epfWages, ee: t.ee + r.epfEe, eps: t.eps + r.epsEr, epf: t.epf + r.epfEpsDiff }), { wages: 0, ee: 0, eps: 0, epf: 0 });
    return { rows, text, warnings, totals: { ...totals, edli: slips.reduce((s, x) => s + num(x.pfEdli), 0), admin: slips.reduce((s, x) => s + num(x.pfAdmin), 0), members: rows.length } };
  }

  async esi(companyId: string, month: number, year: number) {
    const slips = (await this.slips(companyId, month, year)).filter((s) => num(s.esiEmployee) > 0);
    const rows = slips.map((s) => ({
      ip_number: s.employee.esicNumber || '', ip_name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), days_worked: num(s.paymentDays),
      total_wages: Math.round(num(s.grossPay)), employee_contribution: num(s.esiEmployee), employer_contribution: num(s.esiEmployer), reason_code: 0,
      last_working_day: s.employee.lastWorkingDate ? isoDate(s.employee.lastWorkingDate) : '',
    }));
    return { rows, csv: toCsv(rows, ['ip_number', 'ip_name', 'days_worked', 'total_wages', 'employee_contribution', 'employer_contribution', 'reason_code', 'last_working_day']) };
  }

  async pt(companyId: string, month: number, year: number) {
    const slips = (await this.slips(companyId, month, year)).filter((s) => num(s.professionalTax) > 0);
    const rows = slips.map((s) => ({ employee_code: s.employee.employeeCode, name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), state: s.employee.professionalTaxState || '', gross: Math.round(num(s.grossPay)), professional_tax: num(s.professionalTax) }));
    return { rows, total: rows.reduce((t, r) => t + r.professional_tax, 0), csv: toCsv(rows, ['employee_code', 'name', 'state', 'gross', 'professional_tax']) };
  }

  /** NEFT/IMPS bulk-upload style advice for approved payroll. */
  async bankAdvice(companyId: string, month: number, year: number) {
    const slips = await this.slips(companyId, month, year, ['APPROVED', 'PAID']);
    const missing: string[] = [];
    const rows = slips.map((s) => {
      const acct = this.crypto.decrypt(s.employee.bankAccountNumber);
      if (!acct || !s.employee.ifscCode) missing.push(`${s.employee.employeeCode} ${s.employee.firstName}`);
      return { employee_code: s.employee.employeeCode, beneficiary_name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), account_number: acct || '', ifsc: s.employee.ifscCode || '', bank: s.employee.bankName || '', amount: Math.round(num(s.netPay)), narration: `Salary ${String(month).padStart(2, '0')}/${year}` };
    });
    return { rows, missingBankDetails: missing, total: rows.reduce((t, r) => t + r.amount, 0), csv: toCsv(rows, ['employee_code', 'beneficiary_name', 'account_number', 'ifsc', 'bank', 'amount', 'narration']) };
  }

  async register(companyId: string, month: number, year: number) {
    const slips = await this.slips(companyId, month, year);
    const earnCols = new Set<string>();
    const dedCols = new Set<string>();
    for (const s of slips) {
      s.earnings.forEach((e) => earnCols.add(e.salaryComponent.abbr));
      s.deductions.forEach((e) => dedCols.add(e.salaryComponent.abbr));
    }
    const rows = slips.map((s) => {
      const r: Record<string, unknown> = { employee_code: s.employee.employeeCode, name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), paid_days: num(s.paymentDays), lop: num(s.leaveWithoutPay) + num(s.absentDays) };
      for (const c of earnCols) r[c] = s.earnings.filter((e) => e.salaryComponent.abbr === c).reduce((t, e) => t + num(e.amount), 0);
      r.gross = num(s.grossPay);
      for (const c of dedCols) r[`${c}_ded`] = s.deductions.filter((e) => e.salaryComponent.abbr === c).reduce((t, e) => t + num(e.amount), 0);
      r.total_deductions = num(s.totalDeductions);
      r.net_pay = num(s.netPay);
      r.status = s.status;
      return r;
    });
    const cols = ['employee_code', 'name', 'paid_days', 'lop', ...earnCols, 'gross', ...[...dedCols].map((c) => `${c}_ded`), 'total_deductions', 'net_pay', 'status'];
    return { rows, csv: toCsv(rows, cols), columns: cols };
  }

  /** Quarterly salary-TDS deductee extract: Form 24Q up to FY 2025-26, Form 143 from tax year 2026-27 (validate in the RPU before filing). */
  async form24q(companyId: string, fyStartYear: number, quarter: 1 | 2 | 3 | 4) {
    const fy = fiscalYearRange(fyStartYear);
    const months = [[4, 5, 6], [7, 8, 9], [10, 11, 12], [1, 2, 3]][quarter - 1];
    const slips = await this.prisma.salarySlip.findMany({
      where: { companyId, status: { in: ['APPROVED', 'PAID'] }, startDate: { gte: fy.start, lte: fy.end }, month: { in: months } }, include: { employee: true },
    });
    const byEmp = new Map<string, { code: string; name: string; pan: string; gross: number; tds: number }>();
    for (const s of slips) {
      const cur = byEmp.get(s.employeeId) || { code: s.employee.employeeCode, name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), pan: this.crypto.decrypt(s.employee.panNumber) || '', gross: 0, tds: 0 };
      cur.gross += num(s.grossPay);
      cur.tds += num(s.tds);
      byEmp.set(s.employeeId, cur);
    }
    const rows = [...byEmp.values()].map((r) => ({ employee_code: r.code, deductee_name: r.name, pan: r.pan || 'PANNOTAVBL', gross_salary_paid: Math.round(r.gross), tax_deducted: Math.round(r.tds) }));
    return { fy: fiscalYearLabel(fyStartYear), quarter, rows, totalTds: rows.reduce((t, r) => t + r.tax_deducted, 0), missingPan: rows.filter((r) => r.pan === 'PANNOTAVBL').length, csv: toCsv(rows, ['employee_code', 'deductee_name', 'pan', 'gross_salary_paid', 'tax_deducted']) };
  }

  /** Payment of Bonus Act: bonus wage = min(Basic+DA, ₹7,000 or minimum wage) — eligibility ceiling ₹21,000. */
  async bonus(companyId: string, fyStartYear: number, ratePercent: number, wageCeiling = 7000) {
    if (ratePercent < 8.33 || ratePercent > 20) throw new BadRequestException('Bonus rate must be between 8.33% and 20%');
    const fy = fiscalYearRange(fyStartYear);
    const slips = await this.prisma.salarySlip.findMany({
      where: { companyId, status: { in: ['APPROVED', 'PAID'] }, startDate: { gte: fy.start, lte: fy.end } },
      include: { employee: true, earnings: { include: { salaryComponent: true } } },
    });
    const byEmp = new Map<string, { code: string; name: string; months: number; basicDa: number }>();
    for (const s of slips) {
      const cur = byEmp.get(s.employeeId) || { code: s.employee.employeeCode, name: `${s.employee.firstName} ${s.employee.lastName}`.trim(), months: 0, basicDa: 0 };
      cur.months += 1;
      cur.basicDa += s.earnings.filter((e) => e.salaryComponent.componentType === 'BASIC' || e.salaryComponent.componentType === 'DA').reduce((t, e) => t + num(e.amount), 0);
      byEmp.set(s.employeeId, cur);
    }
    const rows = [...byEmp.values()].map((e) => {
      const avgMonthly = e.months ? e.basicDa / e.months : 0;
      const eligible = avgMonthly <= 21000 && e.months >= 1;
      const bonusWage = Math.min(avgMonthly, wageCeiling);
      return { employee_code: e.code, name: e.name, months_worked: e.months, avg_basic_da: Math.round(avgMonthly), eligible: eligible ? 'Yes' : 'No', bonus_amount: eligible ? Math.round(bonusWage * e.months * (ratePercent / 100)) : 0 };
    });
    return { fy: fiscalYearLabel(fyStartYear), ratePercent, rows, total: rows.reduce((t, r) => t + r.bonus_amount, 0), csv: toCsv(rows, ['employee_code', 'name', 'months_worked', 'avg_basic_da', 'eligible', 'bonus_amount']) };
  }

  // ---- PDFs ---------------------------------------------------------------

  async payslipPdf(user: AuthUser, slipId: string) {
    const s = await this.payroll.getSlipForUser(user, slipId);
    const [company, emp] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: s.companyId } }),
      this.prisma.employee.findUniqueOrThrow({ where: { id: s.employeeId } }),
    ]);
    const acct = this.crypto.decrypt(emp.bankAccountNumber);
    const pan = this.crypto.decrypt(emp.panNumber);
    const buf = await this.pdf.payslip({
      company: { name: company.name, legalName: company.legalName, address: company.address, city: company.city, state: company.state, pincode: company.pincode },
      employee: {
        code: emp.employeeCode, name: `${emp.firstName} ${emp.lastName}`.trim(), department: s.employee.department?.name, designation: s.employee.designation?.name, doj: isoDate(emp.dateOfJoining),
        pan: this.crypto.mask(pan), uan: emp.uanNumber, account: this.crypto.mask(acct),
      },
      month: s.month, year: s.year, paymentDays: num(s.paymentDays), totalDays: new Date(Date.UTC(s.year, s.month, 0)).getUTCDate(), lop: num(s.leaveWithoutPay) + num(s.absentDays),
      earnings: s.earnings.map((e) => ({ name: e.salaryComponent.name, amount: num(e.amount) })), deductions: s.deductions.map((e) => ({ name: e.salaryComponent.name, amount: num(e.amount) })),
      gross: num(s.grossPay), totalDeductions: num(s.totalDeductions), net: num(s.roundedTotal), employer: { pf: num(s.pfEmployerEpf) + num(s.pfEmployerEps), esi: num(s.esiEmployer) }, regime: s.taxRegime,
    });
    return { buffer: buf, filename: `Payslip_${emp.employeeCode}_${s.year}-${String(s.month).padStart(2, '0')}.pdf` };
  }

  async form16(user: AuthUser, employeeId: string, fyStartYear: number) {
    const isPayroll = ['SUPER_ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN'].includes(user.role);
    if (!isPayroll && user.employeeId !== employeeId) throw new BadRequestException('You can only download your own tax statement');
    const emp = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId: user.companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const fy = fiscalYearRange(fyStartYear);
    const slips = await this.prisma.salarySlip.findMany({ where: { employeeId, status: { in: ['APPROVED', 'PAID'] }, startDate: { gte: fy.start, lte: fy.end } }, include: { earnings: { include: { salaryComponent: true } } } });
    if (!slips.length) throw new NotFoundException('No processed payroll found for this financial year');

    const sum = (k: 'taxableEarnings' | 'pfEmployee' | 'professionalTax' | 'tds' | 'grossPay') => slips.reduce((t, s) => t + num(s[k]), 0);
    const decl = await this.tax.loadDeclaration(employeeId, fyStartYear);
    const regime = decl?.isSubmitted ? decl.taxRegime : slips[slips.length - 1].taxRegime;
    const age = emp.dateOfBirth ? Math.floor((fy.end.getTime() - emp.dateOfBirth.getTime()) / (365.25 * 86400000)) : 30;
    const cfg = await this.tax.regimeConfig(regime, fy.start, age);
    const d = decl?.sums || { s80c: 0, s80ccd1b: 0, s80d: 0, homeLoan: 0, other: 0 };
    const earned = (types: string[]) => slips.reduce((t, sl) => t + sl.earnings.filter((e) => types.includes(e.salaryComponent.componentType || '')).reduce((a, e) => a + num(e.amount), 0), 0);
    const hra = regime === 'OLD' && decl
      ? hraExemption({ hraReceived: earned(['HRA']), basicPlusDa: earned(['BASIC', 'DA']), rentPaid: decl.monthlyRent * slips.length, metro: decl.rentedInMetro })
      : 0;
    const result = computeTax({
      regime, grossAnnualIncome: sum('taxableEarnings'), age, config: cfg,
      deductions: regime === 'OLD' ? { professionalTax: sum('professionalTax'), section80C: d.s80c + sum('pfEmployee'), section80CCD1B: d.s80ccd1b, section80D: d.s80d, homeLoanInterest: d.homeLoan, hraExemption: hra, otherChapterVIA: d.other } : {},
    });
    const labels: Record<string, string> = { standardDeduction: 'Standard deduction', professionalTax: 'Professional tax', section80C: 'Section 80C (incl. PF)', section80CCD1B: 'Section 80CCD(1B)', section80D: 'Section 80D', homeLoanInterest: 'Home loan interest (24b)', hraExemption: 'HRA exemption (10(13A))', otherChapterVIA: 'Other Chapter VI-A', employerNps: 'Employer NPS 80CCD(2)' };
    const rows = Object.entries(result.deductionBreakup).filter(([, v]) => v > 0).map(([k, v]) => [labels[k] || k, Math.round(v)] as [string, number]);
    const buffer = await this.pdf.form16Summary({
      company: { name: company.legalName, tan: company.tan, pan: company.pan }, employee: { code: emp.employeeCode, name: `${emp.firstName} ${emp.lastName}`.trim(), pan: this.crypto.decrypt(emp.panNumber) },
      fy: fiscalYearLabel(fyStartYear), regime, rows, grossSalary: result.grossIncome, taxable: result.taxableIncome, taxOnIncome: result.taxOnIncome, rebate: result.rebate, surcharge: result.surcharge, cess: result.cess,
      totalTax: result.totalTax, tdsDeducted: Math.round(sum('tds')),
    });
    return { buffer, filename: `TaxStatement_${emp.employeeCode}_FY${fiscalYearLabel(fyStartYear)}.pdf` };
  }
}
