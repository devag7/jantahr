/**
 * Creates the Razorpay subscription plans JantaHR bills against and prints the RAZORPAY_PLAN_IDS value for the API.
 * Amounts come from the plan catalogue (src/modules/billing/plans.ts): per seat, for one billing period, including
 * 18% GST, because Razorpay charges the plan amount and the JantaHR invoice splits the tax back out.
 *
 *   pnpm --filter jantahr-backend razorpay:plans            create what is missing (needs RAZORPAY_KEY_ID / _SECRET)
 *   pnpm --filter jantahr-backend razorpay:plans --dry-run  only show the plans and amounts
 *
 * Safe to re-run: a plan that already exists with the same key and amount is reused. Test keys (rzp_test_…) and live
 * keys (rzp_live_…) have separate plans, so run it once for each and keep the two outputs apart.
 */
import { GST_RATE, PLANS, PlanKey } from '../src/modules/billing/plans';

type Cycle = 'MONTHLY' | 'ANNUAL';
interface Wanted { key: string; name: string; period: 'monthly' | 'yearly'; amount: number; description: string }
interface RazorpayPlan { id: string; period: string; interval: number; item: { name: string; amount: number; currency: string }; notes?: Record<string, string> }

export function wantedPlans(): Wanted[] {
  const out: Wanted[] = [];
  for (const plan of Object.keys(PLANS) as PlanKey[]) {
    const price = PLANS[plan].pricePaise;
    if (!price || !price.MONTHLY) continue; // Free and contact-sales plans are not billed through Razorpay
    for (const cycle of ['MONTHLY', 'ANNUAL'] as Cycle[]) {
      const beforeTax = cycle === 'ANNUAL' ? price.ANNUAL * 12 : price.MONTHLY;
      out.push({
        key: `${plan}_${cycle}`,
        name: `JantaHR ${PLANS[plan].name} (${cycle === 'ANNUAL' ? 'yearly' : 'monthly'})`,
        period: cycle === 'ANNUAL' ? 'yearly' : 'monthly',
        amount: Math.round(beforeTax * (1 + GST_RATE)),
        description: `Per employee seat, ${cycle === 'ANNUAL' ? 'per year' : 'per month'}, including 18% GST`,
      });
    }
  }
  return out;
}

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const wanted = wantedPlans();
  if (dryRun) {
    for (const w of wanted) console.log(`${w.key.padEnd(22)} ${w.period.padEnd(8)} ${rupees(w.amount).padStart(10)}  ${w.name}`);
    return;
  }
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (packages/backend/.env), or pass --dry-run');
  const mode = keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST';
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
    if (!res.ok) throw new Error(`Razorpay ${method} ${path} failed (${res.status}): ${data.error?.description || 'no detail'}`);
    return data;
  };

  const existing: RazorpayPlan[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await call<{ items: RazorpayPlan[] }>('GET', `/plans?count=100&skip=${skip}`);
    existing.push(...page.items);
    if (page.items.length < 100) break;
  }

  const ids: Record<string, string> = {};
  for (const w of wanted) {
    const match = existing.find((p) => p.notes?.jantahr_key === w.key && p.item.amount === w.amount && p.period === w.period && p.interval === 1 && p.item.currency === 'INR');
    if (match) { ids[w.key] = match.id; console.log(`exists   ${w.key.padEnd(22)} ${rupees(w.amount).padStart(10)}  ${match.id}`); continue; }
    const created = await call<RazorpayPlan>('POST', '/plans', {
      period: w.period, interval: 1, item: { name: w.name, amount: w.amount, currency: 'INR', description: w.description }, notes: { jantahr_key: w.key },
    });
    ids[w.key] = created.id;
    console.log(`created  ${w.key.padEnd(22)} ${rupees(w.amount).padStart(10)}  ${created.id}`);
  }
  console.log(`\n${mode} mode. Set this on the API (one line):\nRAZORPAY_PLAN_IDS=${JSON.stringify(ids)}`);
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
