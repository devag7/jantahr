/**
 * Salary allowances that are exempt up to a limit (Income-tax Rules, 2026 from tax year 2026-27; Rules 1962 before).
 *  - Children's education allowance: ₹3,000 per child per month (was ₹100), max 2 children — old regime only.
 *  - Hostel expenditure allowance: ₹9,000 per child per month (was ₹300), max 2 children — old regime only.
 *  - Meal vouchers / food at work: ₹200 per meal (was ₹50) — a perquisite-valuation rule, so it applies in both regimes.
 */
export const EXEMPTION_CODES = ['CHILD_EDUCATION', 'HOSTEL', 'MEAL'] as const;
export type ExemptionCode = (typeof EXEMPTION_CODES)[number];

export function allowanceLimits(fyStartYear: number) {
  return fyStartYear >= 2026 ? { CHILD_EDUCATION: 3000, HOSTEL: 9000, MEAL: 200 } : { CHILD_EDUCATION: 100, HOSTEL: 300, MEAL: 50 };
}

/** Working-day meals assumed per month when meal vouchers are paid as a flat monthly amount. */
export const MEALS_PER_MONTH = 22;

export function allowanceExemption(p: { code: ExemptionCode; received: number; months: number; children: number; regime: 'OLD' | 'NEW'; fyStartYear: number }): number {
  if (p.received <= 0 || p.months <= 0) return 0;
  const lim = allowanceLimits(p.fyStartYear);
  if (p.code === 'MEAL') return Math.min(p.received, lim.MEAL * MEALS_PER_MONTH * p.months);
  if (p.regime === 'NEW') return 0;
  const kids = Math.max(0, Math.min(2, Math.floor(p.children)));
  return Math.min(p.received, lim[p.code] * kids * p.months);
}

/** Total exemption across codes. `byCode` = annual (projected) amount received per code. */
export function totalAllowanceExemption(byCode: Partial<Record<ExemptionCode, number>>, o: { months: number; children: number; regime: 'OLD' | 'NEW'; fyStartYear: number }): number {
  return EXEMPTION_CODES.reduce((s, code) => s + allowanceExemption({ code, received: byCode[code] ?? 0, ...o }), 0);
}
