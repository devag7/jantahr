// Cloud-edition billing & entitlements. Run against an API started with:
//   EDITION=cloud BILLING_PROVIDER=mock CRON_SECRET=<32+ chars> RAZORPAY_WEBHOOK_SECRET=<secret>
// then: API=http://localhost:3010 CRON_SECRET=... RAZORPAY_WEBHOOK_SECRET=... node test/billing-smoke.mjs
import crypto from 'node:crypto';
import { signIn, signUp } from './support/supabase-auth.mjs';

const BASE = process.env.API || 'http://localhost:3010';
const CRON = process.env.CRON_SECRET || '';
const WHSEC = process.env.RAZORPAY_WEBHOOK_SECRET || '';
let failures = 0, passes = 0;
const ok = (name, cond, extra) => { if (cond) passes++; else { failures++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ''); } };
async function call(method, path, token, body, headers = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json().catch(() => null) : await res.text(), ct };
}
const login = (email, password) => signIn(email, password);

// ---- catalogue & runtime ----
const plans = await call('GET', '/billing/plans');
ok('public plan catalogue', plans.status === 200 && plans.data.plans.length === 4 && plans.data.edition === 'cloud' && plans.data.plans.find((p) => p.key === 'STANDARD').pricePaise.MONTHLY === 5900, plans.data);
const rt = await call('GET', '/meta/runtime');
ok('runtime says cloud edition', rt.data?.edition === 'cloud', rt.data);

// ---- demo tenant is on paid Professional ----
const A = (await login('admin@jantahr.com', 'Admin@123')).accessToken;
const entA = await call('GET', '/billing/entitlements', A);
ok('demo tenant: Professional, 50 seats', entA.data?.plan === 'PROFESSIONAL' && entA.data.seatLimit === 50 && entA.data.features.includes('recruitment'), entA.data);

// ---- a new signup starts on a Professional trial ----
const stamp = Date.now().toString(36);
const meenakshi = await signUp(`meenakshi.${stamp}@kaveri.example`, 'Kaveri2026');
const su = await call('POST', '/auth/provision', meenakshi.accessToken, { companyName: `Kaveri Foods ${stamp}`, firstName: 'Meenakshi', lastName: 'Iyer', state: 'Karnataka' });
ok('signup', su.status === 201, su.data);
const T = meenakshi.accessToken;
const entT = await call('GET', '/billing/entitlements', T);
ok('trial = Professional with a countdown', entT.data?.plan === 'PROFESSIONAL' && entT.data.status === 'TRIALING' && /14 days left/.test(entT.data.notice), entT.data);
ok('trial can use recruitment', (await call('GET', '/recruitment/jobs', T)).status === 200);

// ---- checkout (mock provider) ----
ok('minimum 10 seats', (await call('POST', '/billing/checkout', T, { plan: 'STANDARD', cycle: 'MONTHLY', seats: 5 })).status === 400);
ok('free/enterprise not purchasable online', (await call('POST', '/billing/checkout', T, { plan: 'ENTERPRISE', cycle: 'MONTHLY', seats: 300 })).status === 400);
const co = await call('POST', '/billing/checkout', T, { plan: 'STANDARD', cycle: 'MONTHLY', seats: 10 });
ok('checkout quotes GST (intra-state CGST+SGST)', co.status === 201 && co.data.provider === 'mock' && co.data.amount.taxablePaise === 59000 && co.data.amount.cgstPaise === 5310 && co.data.amount.sgstPaise === 5310 && co.data.amount.totalPaise === 69620, co.data);
const conf = await call('POST', '/billing/checkout/confirm', T, {});
ok('confirm activates Standard', conf.status === 201 && conf.data.subscription.plan === 'STANDARD' && conf.data.subscription.status === 'ACTIVE' && conf.data.entitlements.seatLimit === 10, conf.data?.subscription);
const inv = conf.data.invoices?.[0];
ok('GST invoice issued', inv && /^JH\/\d{4}-\d{2}\/\d{6}$/.test(inv.number) && inv.totalPaise === 69620 && inv.cgstPaise + inv.sgstPaise + inv.taxablePaise === 69620, inv);
const pdf = await fetch(`${BASE}/billing/invoices/${inv.id}/pdf`, { headers: { authorization: `Bearer ${T}` } });
ok('invoice PDF', pdf.status === 200 && (pdf.headers.get('content-type') || '').includes('pdf') && (await pdf.arrayBuffer()).byteLength > 1500);
ok('other tenants cannot read the invoice', (await fetch(`${BASE}/billing/invoices/${inv.id}/pdf`, { headers: { authorization: `Bearer ${A}` } })).status === 404);

// ---- plan gating ----
const perf = await call('GET', '/performance/cycles', T);
ok('Standard blocks Professional modules with 402 PLAN_REQUIRED', perf.status === 402 && perf.data?.code === 'PLAN_REQUIRED' && perf.data.feature === 'performance', perf.data);
ok('Standard includes payroll', (await call('GET', '/payroll/runs', T)).status === 200);
ok('Standard blocks analytics', (await call('POST', '/reports/custom', T, { entity: 'employees', columns: ['name'] })).status === 402);
const tCompany = (await call('GET', '/auth/me', T)).data?.company?.id;
ok('careers page hidden without recruitment', (await call('GET', `/public/careers/company/${tCompany}`)).status === 404);

// ---- seat limit ----
let created = 0;
for (let i = 1; i <= 9; i++) {
  const r = await call('POST', '/employees', T, { firstName: 'Seat', lastName: `Holder${i}`, email: `seat${i}.${stamp}@kaveri.example`, gender: 'FEMALE', dateOfJoining: '2026-09-01' });
  if (r.status === 201) created++;
}
ok('fills 10 seats', created === 9, created);
const over = await call('POST', '/employees', T, { firstName: 'Eleventh', lastName: 'Hire', email: `eleven.${stamp}@kaveri.example`, gender: 'MALE', dateOfJoining: '2026-09-01' });
ok('11th employee blocked with SEAT_LIMIT', over.status === 402 && over.data?.code === 'SEAT_LIMIT', over.data);
ok('cannot drop below active employees', (await call('POST', '/billing/seats', T, { seats: 8 })).status === 400);
ok('add seats', (await call('POST', '/billing/seats', T, { seats: 12 })).data?.subscription?.seats === 12);
ok('hire after adding seats', (await call('POST', '/employees', T, { firstName: 'Eleventh', lastName: 'Hire', email: `eleven.${stamp}@kaveri.example`, gender: 'MALE', dateOfJoining: '2026-09-01' })).status === 201);
ok('only super admin buys', (await call('POST', '/billing/checkout', (await login('hr@jantahr.com', 'Demo@1234')).accessToken, { plan: 'STANDARD', cycle: 'MONTHLY', seats: 10 })).status === 403);

// ---- webhooks ----
const overview = await call('GET', '/billing', T);
const subId = overview.data.subscription.providerSubscriptionId;
const halted = JSON.stringify({ entity: 'event', event: 'subscription.halted', payload: { subscription: { entity: { id: subId, status: 'halted', quantity: 12 } } } });
const sign = (b) => crypto.createHmac('sha256', WHSEC).update(b).digest('hex');
ok('webhook rejects bad signature', (await call('POST', '/billing/webhooks/razorpay', null, halted, { 'x-razorpay-signature': 'deadbeef', 'x-razorpay-event-id': `evt_${stamp}_1` })).status === 401);
const wh = await call('POST', '/billing/webhooks/razorpay', null, halted, { 'x-razorpay-signature': sign(halted), 'x-razorpay-event-id': `evt_${stamp}_1` });
ok('webhook accepted', wh.status === 200 && wh.data?.ok === true, wh.data);
ok('replayed event is a no-op', (await call('POST', '/billing/webhooks/razorpay', null, halted, { 'x-razorpay-signature': sign(halted), 'x-razorpay-event-id': `evt_${stamp}_1` })).status === 200);
await new Promise((r) => setTimeout(r, 16000)); // entitlement cache TTL is 15 s
const entH = await call('GET', '/billing/entitlements', T);
ok('halted: Free plan, payroll read-only', entH.data?.plan === 'FREE' && entH.data.readOnlyFeatures.includes('payroll'), entH.data);
ok('read-only: payroll GET still works', (await call('GET', '/payroll/runs', T)).status === 200);
const write = await call('POST', '/payroll/runs', T, { month: 9, year: 2026 });
ok('read-only: payroll writes blocked', write.status === 402 && /read-only/.test(write.data?.message), write.data);
const charged = JSON.stringify({ entity: 'event', event: 'subscription.charged', payload: { subscription: { entity: { id: subId, status: 'active', quantity: 12, current_start: Math.floor(Date.now() / 1000), current_end: Math.floor(Date.now() / 1000) + 30 * 86400 } }, payment: { entity: { id: `pay_${stamp}`, amount: 83544, status: 'captured' } } } });
ok('renewal webhook', (await call('POST', '/billing/webhooks/razorpay', null, charged, { 'x-razorpay-signature': sign(charged), 'x-razorpay-event-id': `evt_${stamp}_2` })).status === 200);
const afterRenew = await call('GET', '/billing', T);
ok('renewal reactivates and invoices the charged amount', afterRenew.data.subscription.status === 'ACTIVE' && afterRenew.data.invoices.some((i) => i.providerPaymentId === `pay_${stamp}` && i.totalPaise === 83544), afterRenew.data.invoices?.map((i) => [i.providerPaymentId, i.totalPaise]));

// ---- cancel ----
const cancel = await call('POST', '/billing/cancel', T);
ok('cancel at period end', cancel.data?.status === 'CANCELLED' && cancel.data.cancelAtPeriodEnd === true, cancel.data);

// ---- jobs endpoint ----
ok('jobs endpoint needs the cron secret', (await call('GET', '/internal/jobs/billing-sweep')).status === 401);
const job = await call('GET', '/internal/jobs/billing-sweep', null, undefined, { authorization: `Bearer ${CRON}` });
ok('billing sweep via cron secret', job.status === 200 && job.data?.ok === true, job.data);
ok('unknown job 404', (await call('POST', '/internal/jobs/nope', null, undefined, { authorization: `Bearer ${CRON}` })).status === 404);


// ---- operator view ----
ok('tenant list is operator-only', (await call('GET', '/billing/platform/tenants', T)).status === 403);

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
