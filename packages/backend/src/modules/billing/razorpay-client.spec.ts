import { RazorpayClient, RazorpayError, RAZORPAY_PLAN_KEYS } from './razorpay';

const planIds = Object.fromEntries(RAZORPAY_PLAN_KEYS.map((k) => [k, `plan_${k}`]));
const client = (ids = planIds) => new RazorpayClient({ keyId: 'rzp_test_x', keySecret: 's', planIds: ids });
const respond = (status: number, body: unknown) => jest.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const failure = async (run: Promise<unknown>) => run.then(() => { throw new Error('expected a RazorpayError'); }, (e) => e as RazorpayError);

describe('Razorpay client failures', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('reports a rejected API key as a credentials problem', async () => {
    global.fetch = respond(401, { error: { description: 'Authentication failed' } });
    const e = await failure(client().createSubscription({ plan: 'STANDARD', cycle: 'ANNUAL', seats: 10, notes: {} }));
    expect(e).toBeInstanceOf(RazorpayError);
    expect(e).toMatchObject({ kind: 'credentials', status: 401, message: 'Authentication failed' });
  });

  it('reports a network failure as unreachable, not as a crash', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    expect(await failure(client().cancel('sub_1', true))).toMatchObject({ kind: 'unreachable', status: 0 });
  });

  it('refuses a plan that is not configured before calling Razorpay', async () => {
    global.fetch = respond(200, {});
    const e = await failure(Promise.resolve().then(() => client({}).createSubscription({ plan: 'STANDARD', cycle: 'MONTHLY', seats: 10, notes: {} })));
    expect(e).toMatchObject({ kind: 'plans' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('self-check passes when the key works and all four plans exist', async () => {
    global.fetch = respond(200, { id: 'plan_x' });
    await expect(client().verify()).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('self-check names a plan missing from the account or mode', async () => {
    global.fetch = respond(400, { error: { description: 'The id provided does not exist' } });
    expect(await failure(client().verify())).toMatchObject({ kind: 'plans' });
  });

  it('self-check reports a rejected key', async () => {
    global.fetch = respond(401, { error: { description: 'Authentication failed' } });
    expect(await failure(client().verify())).toMatchObject({ kind: 'credentials' });
  });
});
