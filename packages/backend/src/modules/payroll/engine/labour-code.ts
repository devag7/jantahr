/**
 * "Wages" under the Code on Wages 2019 s.2(y) / Code on Social Security s.2(88), in force since 21-Nov-2025.
 * Wages = Basic + DA + retaining allowance. Allowances and other excluded items (HRA, conveyance, special allowance…) are
 * remuneration but not wages — unless they exceed one-half of total remuneration, in which case the excess is added back.
 * The resulting wage base drives PF, gratuity, bonus, leave encashment and F&F.
 */
export const LABOUR_CODES_EFFECTIVE = '2025-11-21';

export interface CodeWages {
  /** Basic + DA the employee is actually paid. */
  basicDa: number;
  /** Total remuneration used for the 50% test. */
  remuneration: number;
  /** Amount added back because allowances exceeded 50% of remuneration. */
  topUp: number;
  /** Wage base for statutory calculations. */
  wages: number;
}

export function codeWages(basicDa: number, remuneration: number): CodeWages {
  const b = Math.max(0, basicDa);
  const total = Math.max(remuneration, b);
  const topUp = Math.max(0, Math.round(total * 0.5 - b));
  return { basicDa: b, remuneration: total, topUp, wages: b + topUp };
}

/** Whether a wage month (period ending on `periodEnd`) falls under the labour-code wage definition. */
export const labourCodesApply = (periodEnd: Date): boolean => periodEnd.toISOString().slice(0, 10) >= LABOUR_CODES_EFFECTIVE;
