import { evaluateFormula, validateFormula } from './formula';
import { calcESI, calcGratuity, calcHalfYearlyPT, calcLWF, calcPF, calcPT, ptHalfYear, esiContributionPeriodStart, pfCeilingForMonth } from './statutory';
import { codeWages, labourCodesApply } from './labour-code';
import { computeTax, hraExemption } from './tax';

describe('formula evaluator', () => {
  it('evaluates precedence, parentheses and unary minus', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateFormula('-5 + 10', {})).toBe(5);
  });
  it('resolves variables case-insensitively and supports functions', () => {
    expect(evaluateFormula('MONTHLY_CTC * 0.40', { monthly_ctc: 100000 })).toBe(40000);
    expect(evaluateFormula('MAX(0, A - B)', { A: 5, B: 9 })).toBe(0);
    expect(evaluateFormula('MIN(BASIC, 15000)', { BASIC: 40000 })).toBe(15000);
    expect(evaluateFormula('IF(BASIC > 20000, 100, 50)', { BASIC: 40000 })).toBe(100);
    expect(evaluateFormula('ROUND(10 / 3)', {})).toBe(3);
  });
  it('rejects unknown identifiers, bad syntax, division by zero and code injection', () => {
    expect(() => evaluateFormula('FOO + 1', {})).toThrow('Unknown variable FOO');
    expect(() => evaluateFormula('1 +', {})).toThrow();
    expect(() => evaluateFormula('1 / 0', {})).toThrow('Division by zero');
    expect(() => evaluateFormula('process.exit(1)', {})).toThrow();
    expect(() => evaluateFormula('constructor', {})).toThrow('Unknown variable');
    expect(() => evaluateFormula('__proto__', {})).toThrow('Unknown variable');
  });
  it('validateFormula reports errors', () => {
    expect(validateFormula('BASIC * 0.5', ['BASIC'])).toBeNull();
    expect(validateFormula('BASIC * ', ['BASIC'])).not.toBeNull();
    expect(validateFormula('NOPE * 2', ['BASIC'])).toMatch(/Unknown variable/);
  });
});

describe('PF', () => {
  it('caps wages at the ₹15,000 ceiling and splits employer share between EPS and EPF', () => {
    const r = calcPF(20000, 15000);
    expect(r).toMatchObject({ pfWages: 15000, employeeEpf: 1800, employerEps: 1250, employerEpf: 550, employerTotal: 1800, edli: 75, adminCharges: 75 });
  });
  it('caps at the ₹25,000 ceiling from 17-Sep-2026: EPF 3,000, EPS 2,083, EDLI/admin 125', () => {
    const r = calcPF(40000, 25000);
    expect(r).toMatchObject({ pfWages: 25000, employeeEpf: 3000, employerEps: 2083, employerEpf: 917, employerTotal: 3000, edli: 125, adminCharges: 125 });
  });
  it('computes on actual wages below ceiling', () => {
    const r = calcPF(10000, 25000);
    expect(r).toMatchObject({ employeeEpf: 1200, employerEps: 833, employerEpf: 367 });
  });
  it('supports contribution on full wages when cap is not applied', () => {
    const r = calcPF(30000, 15000, false);
    expect(r.employeeEpf).toBe(3600);
    expect(r.employerEps).toBe(1250); // EPS stays capped
    expect(r.employerEpf).toBe(3600 - 1250);
  });
  it('is not applicable with zero wages', () => {
    expect(calcPF(0, 25000).applicable).toBe(false);
  });
});

describe('EPF ceiling by wage month', () => {
  it('is ₹15,000 up to August 2026 and ₹25,000 from October 2026', () => {
    expect(pfCeilingForMonth(2026, 8)).toBe(15000);
    expect(pfCeilingForMonth(2026, 10)).toBe(25000);
    expect(pfCeilingForMonth(2027, 3)).toBe(25000);
    expect(pfCeilingForMonth(2025, 4)).toBe(15000);
  });
  it('September 2026 straddles the change: 16 days at 15,000 + 14 days at 25,000 pro rata', () => {
    expect(pfCeilingForMonth(2026, 9, 'PRO_RATA')).toBe(Math.round((16 * 15000 + 14 * 25000) / 30));
    expect(pfCeilingForMonth(2026, 9, 'NEXT_WAGE_MONTH')).toBe(15000);
  });
});

describe('labour-code wages (Code on Wages s.2(y))', () => {
  it('leaves wages alone when Basic+DA is already at least 50% of remuneration', () => {
    expect(codeWages(50000, 100000)).toMatchObject({ topUp: 0, wages: 50000 });
  });
  it('adds back the excess when allowances exceed half of remuneration', () => {
    expect(codeWages(40000, 100000)).toMatchObject({ topUp: 10000, wages: 50000 });
    expect(codeWages(0, 60000).wages).toBe(30000);
  });
  it('applies to wage months on or after 21-Nov-2025', () => {
    expect(labourCodesApply(new Date('2025-11-20T00:00:00Z'))).toBe(false);
    expect(labourCodesApply(new Date('2025-11-30T00:00:00Z'))).toBe(true);
  });
});

describe('ESI', () => {
  it('applies 0.75% / 3.25% rounded up when wages ≤ 21,000', () => {
    expect(calcESI(20000)).toMatchObject({ applicable: true, employee: 150, employer: 650 });
    expect(calcESI(15500)).toMatchObject({ employee: 117, employer: 504 });
  });
  it('is not applicable above the ceiling', () => {
    expect(calcESI(21001).applicable).toBe(false);
  });
  it('stays covered to the end of the contribution period after wages cross ₹21,000', () => {
    expect(calcESI(23000, true)).toMatchObject({ applicable: true, employee: 173, employer: 748 });
  });
  it('contribution periods run Apr–Sep and Oct–Mar', () => {
    expect(esiContributionPeriodStart(2026, 9).toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(esiContributionPeriodStart(2026, 10).toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(esiContributionPeriodStart(2027, 2).toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});

describe('Professional tax', () => {
  const mh = [
    { fromSalary: 0, toSalary: 7500, taxAmount: 0, gender: 'MALE' },
    { fromSalary: 7500.01, toSalary: 10000, taxAmount: 175, gender: 'MALE' },
    { fromSalary: 10000.01, toSalary: 1e12, taxAmount: 200, februaryAmount: 300, gender: 'MALE' },
    { fromSalary: 0, toSalary: 25000, taxAmount: 0, gender: 'FEMALE' },
    { fromSalary: 25000.01, toSalary: 1e12, taxAmount: 200, februaryAmount: 300, gender: 'FEMALE' },
  ];
  it('picks gender-specific slabs and the February override', () => {
    expect(calcPT(mh, 9000, 6, 'MALE')).toBe(175);
    expect(calcPT(mh, 50000, 6, 'MALE')).toBe(200);
    expect(calcPT(mh, 50000, 2, 'MALE')).toBe(300);
    expect(calcPT(mh, 20000, 6, 'FEMALE')).toBe(0);
    expect(calcPT(mh, 26000, 6, 'FEMALE')).toBe(200);
  });
  it('returns 0 for states without slabs', () => {
    expect(calcPT([], 50000, 4)).toBe(0);
  });
  it('half-yearly PT (Tamil Nadu): slab on half-year gross, only in a deduction month', () => {
    const tn = [
      { fromSalary: 0, toSalary: 21000, taxAmount: 0 }, { fromSalary: 21000.01, toSalary: 30000, taxAmount: 180 }, { fromSalary: 30000.01, toSalary: 45000, taxAmount: 425 },
      { fromSalary: 45000.01, toSalary: 60000, taxAmount: 930 }, { fromSalary: 60000.01, toSalary: 75000, taxAmount: 1025 }, { fromSalary: 75000.01, toSalary: 1e12, taxAmount: 1250 },
    ];
    expect(calcHalfYearlyPT(tn, 6 * 50000, 9, [9, 3])).toBe(1250);
    expect(calcHalfYearlyPT(tn, 6 * 8000, 9, [9, 3])).toBe(930);
    expect(calcHalfYearlyPT(tn, 6 * 50000, 8, [9, 3])).toBe(0);
  });
  it('half-year windows are Apr–Sep and Oct–Mar', () => {
    expect(ptHalfYear(2026, 8)).toMatchObject({ monthsElapsed: 4, monthsLeft: 1 });
    expect(ptHalfYear(2027, 3)).toMatchObject({ monthsElapsed: 5, monthsLeft: 0 });
    expect(ptHalfYear(2027, 3).start.toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});

describe('LWF', () => {
  const rate = { employeeAmount: 25, employerAmount: 75, months: '6,12' };
  it('deducts only in configured months', () => {
    expect(calcLWF(rate, 6)).toEqual({ employee: 25, employer: 75 });
    expect(calcLWF(rate, 7)).toEqual({ employee: 0, employer: 0 });
    expect(calcLWF(undefined, 6)).toEqual({ employee: 0, employer: 0 });
  });
});

describe('Income tax FY 2025-26', () => {
  it('new regime: nil tax up to ₹12.75L gross (rebate)', () => {
    expect(computeTax({ regime: 'NEW', grossAnnualIncome: 1275000 }).totalTax).toBe(0);
  });
  it('new regime: marginal relief just above the rebate limit', () => {
    const r = computeTax({ regime: 'NEW', grossAnnualIncome: 1300000 });
    expect(r.taxableIncome).toBe(1225000);
    expect(r.totalTax).toBe(26000); // (25,000 excess) + 4% cess
  });
  it('new regime: ₹15L gross', () => {
    expect(computeTax({ regime: 'NEW', grossAnnualIncome: 1500000 }).totalTax).toBe(97500);
  });
  it('new regime: top of 25% slab', () => {
    expect(computeTax({ regime: 'NEW', grossAnnualIncome: 2475000 }).totalTax).toBe(312000);
  });
  it('new regime ignores old-regime deductions', () => {
    const a = computeTax({ regime: 'NEW', grossAnnualIncome: 1500000 });
    const b = computeTax({ regime: 'NEW', grossAnnualIncome: 1500000, deductions: { section80C: 150000, hraExemption: 100000 } });
    expect(b.totalTax).toBe(a.totalTax);
  });
  it('old regime with 80C', () => {
    const r = computeTax({ regime: 'OLD', grossAnnualIncome: 1000000, deductions: { section80C: 150000 } });
    expect(r.taxableIncome).toBe(800000);
    expect(r.totalTax).toBe(75400);
  });
  it('old regime caps 80C at 1.5L and applies 87A rebate up to ₹5L', () => {
    expect(computeTax({ regime: 'OLD', grossAnnualIncome: 1000000, deductions: { section80C: 400000 } }).taxableIncome).toBe(800000);
    expect(computeTax({ regime: 'OLD', grossAnnualIncome: 550000 }).totalTax).toBe(0);
  });
  it('old regime gives senior citizens a higher basic exemption', () => {
    const young = computeTax({ regime: 'OLD', grossAnnualIncome: 800000, age: 30 }).totalTax;
    const senior = computeTax({ regime: 'OLD', grossAnnualIncome: 800000, age: 65 }).totalTax;
    expect(senior).toBeLessThan(young);
  });
  it('applies surcharge above ₹50L', () => {
    expect(computeTax({ regime: 'NEW', grossAnnualIncome: 6000000 }).totalTax).toBe(1552980);
  });
  it('surcharge marginal relief keeps tax+surcharge within income above the threshold', () => {
    const at50 = computeTax({ regime: 'NEW', grossAnnualIncome: 5075000 }); // taxable exactly 50L
    const above = computeTax({ regime: 'NEW', grossAnnualIncome: 5085000 }); // taxable 50.1L → 10k more income
    expect(above.totalTax - at50.totalTax).toBeLessThanOrEqual(10000 * 1.04 + 1);
  });
});

describe('HRA exemption', () => {
  it('is the least of the three limits', () => {
    expect(hraExemption({ hraReceived: 240000, basicPlusDa: 480000, rentPaid: 300000, metro: true })).toBe(240000);
    expect(hraExemption({ hraReceived: 240000, basicPlusDa: 480000, rentPaid: 300000, metro: false })).toBe(192000);
    expect(hraExemption({ hraReceived: 240000, basicPlusDa: 480000, rentPaid: 60000, metro: true })).toBe(12000);
    expect(hraExemption({ hraReceived: 0, basicPlusDa: 480000, rentPaid: 300000, metro: true })).toBe(0);
  });
});

describe('Gratuity', () => {
  it('needs ~5 years and uses 15/26 formula', () => {
    expect(calcGratuity(60000, 5.0)).toEqual({ eligible: true, years: 5, amount: 173077 });
    expect(calcGratuity(60000, 3.2).eligible).toBe(false);
    expect(calcGratuity(60000, 1.2, { fixedTerm: true })).toMatchObject({ eligible: true, years: 1, amount: 34615 });
    expect(calcGratuity(60000, 0.9, { fixedTerm: true }).eligible).toBe(false);
  });
  it('rounds >6 months up and caps at ₹20L', () => {
    expect(calcGratuity(60000, 5.6).years).toBe(6);
    expect(calcGratuity(500000, 30).amount).toBe(2000000);
  });
});
