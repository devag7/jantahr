import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

const account = { userId: 'u1', email: 'a@x.in', role: 'EMPLOYEE', companyId: 'c1', employeeId: 'e1', isActive: true, mfaEnabled: false, sessionsRevokedAt: null as number | null };
const now = Math.floor(Date.now() / 1000);

function setup(opts: { claims?: Record<string, unknown>; acct?: typeof account | null; googleInPlan?: boolean; signedInOnly?: boolean; edition?: string } = {}) {
  process.env.EDITION = opts.edition ?? 'cloud';
  const reflector = { getAllAndOverride: (key: string) => (key === 'signedInOnly' ? !!opts.signedInOnly : false) } as unknown as Reflector;
  const supabase = { verifyAccessToken: async (t: string) => { if (t === 'bad') throw new Error('bad'); return { sub: 'auth-1', email: 'A@x.in', iat: now, aal: 'aal1', amr: [{ method: 'password' }], ...opts.claims }; } };
  const accounts = { byAuthId: async () => (opts.acct === undefined ? account : opts.acct) };
  const entitlements = { has: async () => opts.googleInPlan ?? false };
  const guard = new AuthGuard(reflector, supabase as never, accounts as never, entitlements as never);
  const req: { headers: { authorization: string }; user?: unknown; session?: unknown } = { headers: { authorization: 'Bearer token' } };
  const ctx = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => req }) };
  return { run: (token = 'token') => { req.headers.authorization = `Bearer ${token}`; return guard.canActivate(ctx as never); }, req };
}
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return ((e as UnauthorizedException).getResponse() as { code?: string }).code ?? 'plain'; } };

describe('AuthGuard (Supabase sessions → JantaHR accounts)', () => {
  afterAll(() => { delete process.env.EDITION; });

  it('attaches the JantaHR user and the Supabase session', async () => {
    const t = setup();
    await expect(t.run()).resolves.toBe(true);
    expect(t.req.user).toEqual({ userId: 'u1', email: 'a@x.in', role: 'EMPLOYEE', companyId: 'c1', employeeId: 'e1' });
    expect(t.req.session).toMatchObject({ authId: 'auth-1', email: 'a@x.in', aal: 'aal1', methods: ['password'] });
  });
  it('rejects invalid tokens and unlinked Supabase users', async () => {
    expect(await code(setup().run('bad'))).toBe('SESSION_INVALID');
    expect(await code(setup({ acct: null }).run())).toBe('NO_ACCOUNT');
  });
  it('lets an unlinked user reach sign-up-only routes', async () => {
    await expect(setup({ acct: null, signedInOnly: true }).run()).resolves.toBe(true);
  });
  it('rejects disabled accounts and tokens issued before HR ended the sessions', async () => {
    expect(await code(setup({ acct: { ...account, isActive: false } }).run())).toBe('ACCOUNT_DISABLED');
    expect(await code(setup({ acct: { ...account, sessionsRevokedAt: (now + 5) * 1000 } }).run())).toBe('SESSION_INVALID');
    expect(await code(setup({ acct: { ...account, sessionsRevokedAt: now * 1000 + 400 } }).run())).toBe('ok'); // same second = signed in after
  });
  it('requires AAL2 once the user has two-factor', async () => {
    expect(await code(setup({ acct: { ...account, mfaEnabled: true } }).run())).toBe('MFA_REQUIRED');
    expect(await code(setup({ acct: { ...account, mfaEnabled: true }, claims: { aal: 'aal2' } }).run())).toBe('ok');
  });
  it('gates Google sign-in by plan on the cloud edition only', async () => {
    const google = { amr: [{ method: 'oauth' }] };
    expect(await code(setup({ claims: google }).run())).toBe('SSO_NOT_IN_PLAN');
    expect(await code(setup({ claims: google, googleInPlan: true }).run())).toBe('ok');
    expect(await code(setup({ claims: google, edition: 'self_hosted' }).run())).toBe('ok');
  });
});
