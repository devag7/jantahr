/** EPF wage ceiling by effective date. ₹25,000 from 17-Sep-2026 (Gazette S.O. 5109(E), Code on Social Security s.2(89)); ₹15,000 since Sep-2014. */
export const PF_CEILING_HISTORY: { from: string; ceiling: number }[] = [
  { from: '2014-09-01', ceiling: 15000 },
  { from: '2026-09-17', ceiling: 25000 },
];
export const ESI_WAGE_CEILING = 21000;

/**
 * How a wage month that straddles a ceiling change is treated. EPFO had not issued transition guidance at the time of writing,
 * so this is a switch: PRO_RATA blends the two ceilings by calendar days; NEXT_WAGE_MONTH keeps the old ceiling until the next month.
 */
export type PfTransition = 'PRO_RATA' | 'NEXT_WAGE_MONTH';

const ceilingOn = (iso: string): number => PF_CEILING_HISTORY.filter((h) => h.from <= iso).pop()?.ceiling ?? PF_CEILING_HISTORY[0].ceiling;

/** EPF wage ceiling that applies to the wage month (month is 1-12). */
export function pfCeilingForMonth(year: number, month: number, transition: PfTransition = 'PRO_RATA'): number {
  const pad = (n: number) => String(n).padStart(2, '0');
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(days)}`;
  const c0 = ceilingOn(first);
  const c1 = ceilingOn(last);
  if (c0 === c1 || transition === 'NEXT_WAGE_MONTH') return c0;
  let weighted = 0;
  for (let d = 1; d <= days; d++) weighted += ceilingOn(`${year}-${pad(month)}-${pad(d)}`);
  return Math.round(weighted / days);
}

const r = Math.round;

export interface PfResult {
  applicable: boolean;
  pfWages: number; // wages on which contribution is computed (after ceiling)
  employeeEpf: number;
  employerEps: number;
  employerEpf: number; // employer's share going to EPF (12% - EPS)
  employerTotal: number;
  edli: number;
  adminCharges: number;
}

/**
 * EPF: employee 12% of PF wages. Employer 12% = 8.33% EPS (on wages capped at the ceiling) + balance to EPF.
 * EDLI 0.5% and admin 0.5% on wages capped at the ceiling. `ceiling` comes from pfCeilingForMonth().
 * `capAtCeiling=false` computes on actual wages (voluntary higher-wage contribution).
 */
export function calcPF(pfWagesActual: number, ceiling: number, capAtCeiling = true): PfResult {
  if (pfWagesActual <= 0) return { applicable: false, pfWages: 0, employeeEpf: 0, employerEps: 0, employerEpf: 0, employerTotal: 0, edli: 0, adminCharges: 0 };
  const pfWages = capAtCeiling ? Math.min(pfWagesActual, ceiling) : pfWagesActual;
  const employeeEpf = r(pfWages * 0.12);
  const epsWages = Math.min(pfWagesActual, ceiling);
  const employerEps = r(epsWages * 0.0833);
  const employerTotal = r(pfWages * 0.12);
  const employerEpf = employerTotal - employerEps;
  return {
    applicable: true, pfWages, employeeEpf, employerEps, employerEpf, employerTotal,
    edli: r(epsWages * 0.005), adminCharges: r(epsWages * 0.005),
  };
}

export interface EsiResult {
  applicable: boolean;
  esiWages: number;
  employee: number;
  employer: number;
  reason?: string;
}

/** ESI contribution periods run Apr–Sep and Oct–Mar; returns the first day (UTC) of the period containing the wage month. */
export function esiContributionPeriodStart(year: number, month: number): Date {
  return month >= 10 ? new Date(Date.UTC(year, 9, 1)) : month >= 4 ? new Date(Date.UTC(year, 3, 1)) : new Date(Date.UTC(year - 1, 9, 1));
}

/**
 * ESI: 0.75% employee + 3.25% employer on gross wages when monthly wages ≤ ₹21,000; rounded UP to next rupee.
 * `stayCovered`: an employee who was covered earlier in the same contribution period stays covered until it ends,
 * even if wages cross ₹21,000 (ESI Act s.2(9) proviso, kept under the Code on Social Security).
 */
export function calcESI(esiWages: number, stayCovered = false): EsiResult {
  if (esiWages <= 0) return { applicable: false, esiWages: 0, employee: 0, employer: 0, reason: 'No ESI wages' };
  if (esiWages > ESI_WAGE_CEILING && !stayCovered) return { applicable: false, esiWages, employee: 0, employer: 0, reason: 'Wages exceed ₹21,000 ceiling' };
  // small epsilon guards against float artefacts like 20000*0.0075 = 150.00000000000003
  const up = (n: number) => Math.ceil(n - 1e-9);
  return { applicable: true, esiWages, employee: up(esiWages * 0.0075), employer: up(esiWages * 0.0325) };
}

export interface PtSlabRow {
  fromSalary: number;
  toSalary: number;
  taxAmount: number;
  februaryAmount?: number | null;
  gender?: string | null;
}

/** Professional tax from state slabs. Gender-specific slabs (e.g. Maharashtra) are honoured when present. */
export function calcPT(slabs: PtSlabRow[], monthlyGross: number, month: number, gender?: string): number {
  if (!slabs.length || monthlyGross <= 0) return 0;
  const genderSlabs = slabs.filter((s) => s.gender && s.gender === gender);
  const pool = genderSlabs.length ? genderSlabs : slabs.filter((s) => !s.gender);
  const use = pool.length ? pool : slabs.filter((s) => !s.gender || s.gender === 'MALE');
  const slab = use.find((s) => monthlyGross >= s.fromSalary && monthlyGross <= s.toSalary);
  if (!slab) return 0;
  return month === 2 && slab.februaryAmount != null ? slab.februaryAmount : slab.taxAmount;
}

/** Half-year (Apr–Sep, Oct–Mar) containing the wage month: its first day and how many months remain after this one. */
export function ptHalfYear(year: number, month: number): { start: Date; monthsElapsed: number; monthsLeft: number } {
  const first = month >= 4 && month <= 9 ? 4 : 10;
  const startYear = month <= 3 ? year - 1 : year;
  const idx = (month - first + 12) % 12;
  return { start: new Date(Date.UTC(startYear, first - 1, 1)), monthsElapsed: idx, monthsLeft: 5 - idx };
}

/**
 * Half-yearly professional tax (Tamil Nadu local bodies, Kerala): slab on the half-year's gross salary, deducted once in
 * one of `deductionMonths`. `halfYearGross` = earned so far in the half + this month + projected remaining months.
 */
export function calcHalfYearlyPT(slabs: PtSlabRow[], halfYearGross: number, month: number, deductionMonths: number[]): number {
  if (!deductionMonths.includes(month) || halfYearGross <= 0) return 0;
  const slab = slabs.find((s) => halfYearGross >= s.fromSalary && halfYearGross <= s.toSalary);
  return slab ? slab.taxAmount : 0;
}

export interface LwfRateRow {
  employeeAmount: number;
  employerAmount: number;
  months: string;
}

export function calcLWF(rate: LwfRateRow | undefined, month: number): { employee: number; employer: number } {
  if (!rate) return { employee: 0, employer: 0 };
  const months = rate.months.split(',').map((m) => parseInt(m.trim(), 10));
  return months.includes(month) ? { employee: rate.employeeAmount, employer: rate.employerAmount } : { employee: 0, employer: 0 };
}

/**
 * Gratuity: (15 × last drawn wages × completed years) / 26, capped at ₹20 lakh. Wages = Basic + DA, topped up to 50% of
 * remuneration under the labour codes (see codeWages). Service beyond 6 months in the last year counts as a full year.
 * Permanent staff need ~5 years (4y 240d by settled case law); fixed-term employees qualify after 1 year, pro rata
 * (Code on Social Security s.53(2), in force 21-Nov-2025).
 */
export const GRATUITY_CAP = 2000000;
export function calcGratuity(lastDrawnWages: number, yearsOfService: number, opts: { fixedTerm?: boolean } = {}): { eligible: boolean; years: number; amount: number } {
  const wholeYears = Math.floor(yearsOfService);
  const frac = yearsOfService - wholeYears;
  const counted = frac > 0.5 ? wholeYears + 1 : wholeYears;
  const minYears = opts.fixedTerm ? 1 : 4.66;
  if (yearsOfService < minYears) return { eligible: false, years: counted, amount: 0 };
  const amount = Math.min(GRATUITY_CAP, Math.round((15 * lastDrawnWages * counted) / 26));
  return { eligible: true, years: counted, amount };
}
