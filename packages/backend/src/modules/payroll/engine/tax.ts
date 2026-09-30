/**
 * Income-tax computation (India) — FY 2025-26 defaults (AY 2026-27).
 *  New regime: slabs 0-4L/4-8L/8-12L/12-16L/16-20L/20-24L/>24L at 0/5/10/15/20/25/30%, std deduction ₹75,000,
 *              87A rebate up to ₹60,000 for taxable income ≤ ₹12L (with marginal relief just above), surcharge capped at 25%.
 *  Old regime: slabs 2.5L/5L/10L at 0/5/20/30%, std deduction ₹50,000, 87A rebate ₹12,500 up to ₹5L, surcharge up to 37%.
 * Slab tables can be overridden (loaded from DB) so a Budget change needs data, not code.
 */
export interface Slab { from: number; to: number; rate: number }

export interface RegimeConfig {
  slabs: Slab[];
  standardDeduction: number;
  rebateLimit: number;
  rebateMax: number;
  marginalReliefAboveRebate: boolean;
  maxSurchargeRate: number;
  cess: number;
}

export const NEW_REGIME: RegimeConfig = {
  slabs: [
    { from: 0, to: 400000, rate: 0 }, { from: 400000, to: 800000, rate: 0.05 }, { from: 800000, to: 1200000, rate: 0.1 },
    { from: 1200000, to: 1600000, rate: 0.15 }, { from: 1600000, to: 2000000, rate: 0.2 }, { from: 2000000, to: 2400000, rate: 0.25 },
    { from: 2400000, to: Infinity, rate: 0.3 },
  ],
  standardDeduction: 75000, rebateLimit: 1200000, rebateMax: 60000, marginalReliefAboveRebate: true, maxSurchargeRate: 0.25, cess: 0.04,
};

export function oldRegimeConfig(age = 30): RegimeConfig {
  const exemption = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;
  const slabs: Slab[] = [{ from: 0, to: exemption, rate: 0 }];
  if (exemption < 500000) slabs.push({ from: exemption, to: 500000, rate: 0.05 });
  slabs.push({ from: 500000, to: 1000000, rate: 0.2 }, { from: 1000000, to: Infinity, rate: 0.3 });
  return { slabs, standardDeduction: 50000, rebateLimit: 500000, rebateMax: 12500, marginalReliefAboveRebate: false, maxSurchargeRate: 0.37, cess: 0.04 };
}

export function slabTax(income: number, slabs: Slab[]): number {
  let tax = 0;
  for (const s of slabs) {
    if (income <= s.from) break;
    tax += (Math.min(income, s.to) - s.from) * s.rate;
  }
  return tax;
}

const SURCHARGE_STEPS = [
  { above: 50000000, rate: 0.37 }, { above: 20000000, rate: 0.25 }, { above: 10000000, rate: 0.15 }, { above: 5000000, rate: 0.1 },
];

function surchargeRate(income: number, cap: number): number {
  const step = SURCHARGE_STEPS.find((s) => income > s.above);
  return step ? Math.min(step.rate, cap) : 0;
}

/** Surcharge with marginal relief: (tax+surcharge) may not exceed tax-at-threshold + income above threshold. */
export function surchargeWithRelief(income: number, tax: number, cfg: RegimeConfig): number {
  const rate = surchargeRate(income, cfg.maxSurchargeRate);
  if (!rate) return 0;
  const threshold = SURCHARGE_STEPS.filter((s) => income > s.above).map((s) => s.above)[0];
  const prevRate = surchargeRate(threshold, cfg.maxSurchargeRate);
  let sc = tax * rate;
  const taxAtThreshold = slabTax(threshold, cfg.slabs);
  const taxAtThresholdWithSurcharge = taxAtThreshold + taxAtThreshold * prevRate;
  const relief = tax + sc - (taxAtThresholdWithSurcharge + (income - threshold));
  if (relief > 0) sc -= relief;
  return Math.max(0, sc);
}

export interface TaxInput {
  regime: 'OLD' | 'NEW';
  grossAnnualIncome: number; // taxable salary before deductions
  age?: number;
  deductions?: {
    professionalTax?: number; // old regime only
    section80C?: number;      // incl. employee PF (old only), capped at 1.5L
    section80CCD1B?: number;  // capped at 50k (old only)
    section80D?: number;      // old only
    homeLoanInterest?: number; // capped at 2L (old only, self-occupied)
    hraExemption?: number;     // old only
    otherChapterVIA?: number;  // old only (80E, 80G, 80TTA...)
    employerNps?: number;      // 80CCD(2) — both regimes
  };
  config?: RegimeConfig;
}

export interface TaxResult {
  regime: 'OLD' | 'NEW';
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxOnIncome: number;
  rebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  effectiveRate: number;
  deductionBreakup: Record<string, number>;
}

export function computeTax(input: TaxInput): TaxResult {
  const cfg = input.config || (input.regime === 'NEW' ? NEW_REGIME : oldRegimeConfig(input.age));
  const d = input.deductions || {};
  const breakup: Record<string, number> = { standardDeduction: cfg.standardDeduction };
  if (d.employerNps) breakup.employerNps = d.employerNps;
  if (input.regime === 'OLD') {
    breakup.professionalTax = Math.max(0, d.professionalTax || 0);
    breakup.section80C = Math.min(Math.max(0, d.section80C || 0), 150000);
    breakup.section80CCD1B = Math.min(Math.max(0, d.section80CCD1B || 0), 50000);
    breakup.section80D = Math.max(0, d.section80D || 0);
    breakup.homeLoanInterest = Math.min(Math.max(0, d.homeLoanInterest || 0), 200000);
    breakup.hraExemption = Math.max(0, d.hraExemption || 0);
    breakup.otherChapterVIA = Math.max(0, d.otherChapterVIA || 0);
  }
  const totalDeductions = Object.values(breakup).reduce((a, b) => a + b, 0);
  const taxableIncome = Math.max(0, Math.round(input.grossAnnualIncome - totalDeductions));

  let tax = slabTax(taxableIncome, cfg.slabs);
  let rebate = 0;
  if (taxableIncome <= cfg.rebateLimit) {
    rebate = Math.min(tax, cfg.rebateMax);
  } else if (cfg.marginalReliefAboveRebate) {
    // Marginal relief: tax payable cannot exceed the income above the rebate threshold
    const excess = taxableIncome - cfg.rebateLimit;
    if (tax > excess) rebate = tax - excess;
  }
  const taxAfterRebate = tax - rebate;
  const surcharge = surchargeWithRelief(taxableIncome, taxAfterRebate, cfg);
  const cess = (taxAfterRebate + surcharge) * cfg.cess;
  const totalTax = Math.round(taxAfterRebate + surcharge + cess);
  return {
    regime: input.regime, grossIncome: Math.round(input.grossAnnualIncome), totalDeductions: Math.round(totalDeductions), taxableIncome,
    taxOnIncome: Math.round(tax), rebate: Math.round(rebate), surcharge: Math.round(surcharge), cess: Math.round(cess), totalTax,
    effectiveRate: input.grossAnnualIncome > 0 ? (totalTax / input.grossAnnualIncome) * 100 : 0, deductionBreakup: breakup,
  };
}

/** HRA exemption (Sec 10(13A)): least of actual HRA, rent paid − 10% of basic, 50% (metro) / 40% of basic. */
export function hraExemption(p: { hraReceived: number; basicPlusDa: number; rentPaid: number; metro: boolean }): number {
  if (p.hraReceived <= 0 || p.rentPaid <= 0) return 0;
  const rentExcess = Math.max(0, p.rentPaid - 0.1 * p.basicPlusDa);
  const cap = (p.metro ? 0.5 : 0.4) * p.basicPlusDa;
  return Math.round(Math.max(0, Math.min(p.hraReceived, rentExcess, cap)));
}
