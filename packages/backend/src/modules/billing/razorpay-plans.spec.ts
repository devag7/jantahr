import { wantedPlans } from '../../../scripts/razorpay-plans';

describe('Razorpay plans derived from the catalogue', () => {
  it('bills each paid plan per seat, tax included, monthly and yearly', () => {
    const byKey = Object.fromEntries(wantedPlans(0.18).map((w) => [w.key, w]));
    expect(Object.keys(byKey).sort()).toEqual(['PROFESSIONAL_ANNUAL', 'PROFESSIONAL_MONTHLY', 'STANDARD_ANNUAL', 'STANDARD_MONTHLY']);
    // ₹59 + 18% = ₹69.62; ₹49 × 12 + 18% = ₹693.84 (the amounts documented in docs/deploy-cloud.md)
    expect(byKey.STANDARD_MONTHLY).toMatchObject({ period: 'monthly', amount: 6962 });
    expect(byKey.STANDARD_ANNUAL).toMatchObject({ period: 'yearly', amount: 69384 });
    expect(byKey.PROFESSIONAL_MONTHLY).toMatchObject({ period: 'monthly', amount: 14042 });
    expect(byKey.PROFESSIONAL_ANNUAL).toMatchObject({ period: 'yearly', amount: 140184 });
  });
  it('charges the plain price when the seller is not GST-registered', () => {
    const byKey = Object.fromEntries(wantedPlans(0).map((w) => [w.key, w]));
    expect(byKey.STANDARD_MONTHLY.amount).toBe(5900);
    expect(byKey.PROFESSIONAL_ANNUAL.amount).toBe(118800);
    expect(byKey.STANDARD_MONTHLY.description).not.toContain('GST');
  });
});
