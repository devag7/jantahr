import * as crypto from 'crypto';
import { resolveEntitlements, selfHostedEntitlements } from './entitlements';
import { gstFromInclusive, gstOnTaxable, invoiceNumber } from './gst';
import { PLANS, periodPricePaise } from './plans';
import { verifyCheckoutSignature, verifyWebhookSignature } from './razorpay';

const now = new Date('2026-09-27T10:00:00Z');
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const sub = (o: Partial<Parameters<typeof resolveEntitlements>[0]> = {}) => ({ plan: 'STANDARD' as const, status: 'ACTIVE' as const, seats: 25, trialEndsAt: null, currentPeriodEnd: d('2026-10-20'), lapsedPlan: null, ...o });

describe('entitlements', () => {
  it('self-hosted edition gets every feature with no seat limit', () => {
    const e = selfHostedEntitlements();
    expect(e.seatLimit).toBeNull();
    expect(e.features).toEqual(expect.arrayContaining(['payroll', 'recruitment', 'analytics', 'googleSignIn', 'privacy']));
  });
  it('no subscription = Free: core features, 20 employees', () => {
    const e = resolveEntitlements(null, now);
    expect(e.plan).toBe('FREE');
    expect(e.features).toContain('privacy');
    expect(e.features).not.toContain('payroll');
    expect(e.seatLimit).toBe(20);
  });
  it('active trial unlocks Professional; expired trial falls back to Free with paid modules read-only', () => {
    const t = resolveEntitlements(sub({ status: 'TRIALING', plan: 'FREE', trialEndsAt: d('2026-10-05') }), now);
    expect(t.plan).toBe('PROFESSIONAL');
    expect(t.notice).toMatch(/8 days left/);
    const x = resolveEntitlements(sub({ status: 'TRIALING', plan: 'FREE', trialEndsAt: d('2026-09-20') }), now);
    expect(x.plan).toBe('FREE');
    expect(x.readOnlyFeatures).toEqual(expect.arrayContaining(['payroll', 'performance']));
  });
  it('active paid plan is limited by seats bought', () => {
    const e = resolveEntitlements(sub(), now);
    expect(e.plan).toBe('STANDARD');
    expect(e.seatLimit).toBe(25);
    expect(e.features).toContain('payroll');
    expect(e.features).not.toContain('recruitment');
  });
  it('past due keeps access for the 7-day grace period, then goes read-only', () => {
    expect(resolveEntitlements(sub({ status: 'PAST_DUE', currentPeriodEnd: d('2026-09-24') }), now).plan).toBe('STANDARD');
    const late = resolveEntitlements(sub({ status: 'PAST_DUE', currentPeriodEnd: d('2026-09-10') }), now);
    expect(late.plan).toBe('FREE');
    expect(late.readOnlyFeatures).toContain('payroll');
  });
  it('cancelled keeps the plan until the paid period ends', () => {
    expect(resolveEntitlements(sub({ status: 'CANCELLED', currentPeriodEnd: d('2026-10-20') }), now).plan).toBe('STANDARD');
    expect(resolveEntitlements(sub({ status: 'CANCELLED', currentPeriodEnd: d('2026-09-01') }), now).plan).toBe('FREE');
  });
  it('halted subscriptions never lose data access: paid modules read-only', () => {
    const e = resolveEntitlements(sub({ status: 'HALTED', plan: 'PROFESSIONAL' }), now);
    expect(e.features).not.toContain('payroll');
    expect(e.readOnlyFeatures).toEqual(expect.arrayContaining(['payroll', 'recruitment']));
  });
});

describe('pricing & GST', () => {
  it('per-seat pricing, annual billed for 12 months', () => {
    expect(periodPricePaise('STANDARD', 'MONTHLY', 30)).toBe(5900 * 30);
    expect(periodPricePaise('PROFESSIONAL', 'ANNUAL', 10)).toBe(9900 * 10 * 12);
    expect(() => periodPricePaise('ENTERPRISE', 'MONTHLY', 300)).toThrow();
    expect(PLANS.FREE.maxEmployees).toBe(20);
  });
  it('intra-state CGST + SGST, inter-state IGST', () => {
    expect(gstOnTaxable(100000, 'Karnataka', 'Karnataka')).toEqual({ taxablePaise: 100000, cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, totalPaise: 118000 });
    expect(gstOnTaxable(100000, 'Karnataka', 'Maharashtra')).toMatchObject({ igstPaise: 18000, cgstPaise: 0, totalPaise: 118000 });
    expect(gstOnTaxable(100000, 'Karnataka', null).igstPaise).toBe(18000);
  });
  it('GST-inclusive charges reconcile to the paisa', () => {
    const g = gstFromInclusive(69620, 'Karnataka', 'Karnataka');
    expect(g.taxablePaise + g.cgstPaise + g.sgstPaise + g.igstPaise).toBe(69620);
    expect(g.taxablePaise).toBe(59000);
  });
  it('invoice numbers run per financial year', () => {
    expect(invoiceNumber(d('2026-09-27'), 42)).toBe('JH/2026-27/000042');
    expect(invoiceNumber(d('2027-02-01'), 7)).toBe('JH/2026-27/000007');
    expect(invoiceNumber(d('2027-04-01'), 1)).toBe('JH/2027-28/000001');
  });
});

describe('Razorpay signatures', () => {
  const secret = 'test_secret_123';
  it('checkout signature is HMAC(payment_id|subscription_id)', () => {
    const signature = crypto.createHmac('sha256', secret).update('pay_ABC|sub_XYZ').digest('hex');
    expect(verifyCheckoutSignature({ paymentId: 'pay_ABC', subscriptionId: 'sub_XYZ', signature }, secret)).toBe(true);
    expect(verifyCheckoutSignature({ paymentId: 'pay_ABC', subscriptionId: 'sub_OTHER', signature }, secret)).toBe(false);
  });
  it('webhook signature is HMAC of the raw body', () => {
    const body = Buffer.from('{"event":"subscription.charged"}');
    const sig = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, 'whsec')).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"event":"subscription.charged" }'), sig, 'whsec')).toBe(false);
    expect(verifyWebhookSignature(body, undefined, 'whsec')).toBe(false);
  });
});
