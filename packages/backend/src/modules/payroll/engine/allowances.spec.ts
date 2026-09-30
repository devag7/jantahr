import { allowanceExemption, totalAllowanceExemption } from './allowances';

describe('allowance exemptions (Income-tax Rules 2026)', () => {
  it('children education ₹3,000/child/month from tax year 2026-27, max two children, old regime only', () => {
    expect(allowanceExemption({ code: 'CHILD_EDUCATION', received: 100000, months: 12, children: 3, regime: 'OLD', fyStartYear: 2026 })).toBe(72000);
    expect(allowanceExemption({ code: 'CHILD_EDUCATION', received: 20000, months: 12, children: 1, regime: 'OLD', fyStartYear: 2026 })).toBe(20000);
    expect(allowanceExemption({ code: 'CHILD_EDUCATION', received: 100000, months: 12, children: 2, regime: 'NEW', fyStartYear: 2026 })).toBe(0);
  });
  it('old limits apply before tax year 2026-27', () => {
    expect(allowanceExemption({ code: 'CHILD_EDUCATION', received: 100000, months: 12, children: 2, regime: 'OLD', fyStartYear: 2025 })).toBe(2400);
    expect(allowanceExemption({ code: 'HOSTEL', received: 100000, months: 12, children: 1, regime: 'OLD', fyStartYear: 2025 })).toBe(3600);
  });
  it('hostel ₹9,000/child/month', () => {
    expect(allowanceExemption({ code: 'HOSTEL', received: 300000, months: 12, children: 2, regime: 'OLD', fyStartYear: 2026 })).toBe(216000);
  });
  it('meal vouchers ₹200/meal × 22 meals, in both regimes', () => {
    expect(allowanceExemption({ code: 'MEAL', received: 60000, months: 12, children: 0, regime: 'NEW', fyStartYear: 2026 })).toBe(52800);
    expect(allowanceExemption({ code: 'MEAL', received: 2000 * 12, months: 12, children: 0, regime: 'NEW', fyStartYear: 2026 })).toBe(24000);
    expect(allowanceExemption({ code: 'MEAL', received: 60000, months: 12, children: 0, regime: 'OLD', fyStartYear: 2025 })).toBe(13200);
  });
  it('totals across codes', () => {
    expect(totalAllowanceExemption({ CHILD_EDUCATION: 36000, MEAL: 24000 }, { months: 12, children: 1, regime: 'OLD', fyStartYear: 2026 })).toBe(60000);
  });
});
