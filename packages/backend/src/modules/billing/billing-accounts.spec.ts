import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';

/** A company whose Standard plan was bought with Razorpay test keys, on a server now running live keys. */
function setup(subProvider: string) {
  const env: Record<string, string> = { EDITION: 'cloud', RAZORPAY_KEY_ID: 'rzp_live_x', RAZORPAY_KEY_SECRET: 's', RAZORPAY_PLAN_IDS: JSON.stringify({ STANDARD_MONTHLY: 'plan_live' }) };
  const prev = process.env.EDITION;
  process.env.EDITION = 'cloud';
  const sub = { id: 's1', companyId: 'c1', plan: 'STANDARD', status: 'ACTIVE', seats: 10, provider: subProvider, providerSubscriptionId: 'sub_test_1', currentPeriodEnd: new Date() };
  const upsert = jest.fn(async () => sub);
  const prisma = {
    subscription: { findUnique: jest.fn(async () => sub), update: jest.fn(async () => sub), upsert },
    employee: { count: jest.fn(async () => 1) },
    company: { findUniqueOrThrow: jest.fn(async () => ({ id: 'c1', name: 'Acme', state: 'Karnataka' })) },
  };
  const service = new BillingService(prisma as never, { get: (k: string) => env[k] } as never, { invalidate: jest.fn() } as never, {} as never);
  return { service, upsert, restore: () => { process.env.EDITION = prev; } };
}
const user = { companyId: 'c1', userId: 'u1', email: 'owner@acme.example' } as never;

describe('subscriptions made on another Razorpay account or mode', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('cannot be changed or cancelled with the live keys, and nothing is sent to Razorpay', async () => {
    const { service, restore } = setup('razorpay_test');
    global.fetch = jest.fn() as never;
    await expect(service.changeSeats(user, 12)).rejects.toThrow(BadRequestException);
    await expect(service.cancel(user)).rejects.toThrow(/different Razorpay account or mode/);
    expect(global.fetch).not.toHaveBeenCalled();
    restore();
  });

  it('can be replaced by a new live checkout, which is recorded as live', async () => {
    const { service, upsert, restore } = setup('razorpay_test');
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ id: 'sub_live_1', status: 'created' }), { status: 200 })) as never;
    const co = await service.checkout(user, { plan: 'STANDARD', cycle: 'MONTHLY', seats: 10 } as never);
    expect(co.subscriptionId).toBe('sub_live_1');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ provider: 'razorpay', providerSubscriptionId: 'sub_live_1' }) }));
    restore();
  });

  it('a live subscription on live keys still blocks a second checkout', async () => {
    const { service, restore } = setup('razorpay');
    await expect(service.checkout(user, { plan: 'STANDARD', cycle: 'MONTHLY', seats: 10 } as never)).rejects.toThrow(/already have an active subscription/);
    restore();
  });
});
