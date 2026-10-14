import * as crypto from 'crypto';

/**
 * Razorpay Subscriptions (India). Checkout returns payment_id + subscription_id + signature; webhooks carry
 * X-Razorpay-Signature = HMAC-SHA256(raw body, webhook secret). Plan amounts in Razorpay are configured GST-inclusive.
 */
const hmac = (secret: string, data: string | Buffer) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function verifyCheckoutSignature(p: { paymentId: string; subscriptionId: string; signature: string }, keySecret: string): boolean {
  return safeEqual(hmac(keySecret, `${p.paymentId}|${p.subscriptionId}`), p.signature || '');
}

export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined, webhookSecret: string): boolean {
  if (!signature) return false;
  return safeEqual(hmac(webhookSecret, rawBody), signature);
}

/**
 * A failed Razorpay call. `status` is the HTTP status (401 = the API key was rejected), or 0 when Razorpay could not
 * be reached or this server is misconfigured. Callers turn it into a response the customer can act on.
 */
export class RazorpayError extends Error {
  constructor(message: string, readonly status: number, readonly kind: 'credentials' | 'plans' | 'unreachable' | 'rejected') { super(message); }
}

export const RAZORPAY_PLAN_KEYS = ['STANDARD_MONTHLY', 'STANDARD_ANNUAL', 'PROFESSIONAL_MONTHLY', 'PROFESSIONAL_ANNUAL'];

export interface RazorpayConfig { keyId: string; keySecret: string; planIds: Record<string, string> }

export class RazorpayClient {
  constructor(private cfg: RazorpayConfig, private base = 'https://api.razorpay.com/v1') {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${this.cfg.keyId}:${this.cfg.keySecret}`).toString('base64')}` },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new RazorpayError(`Razorpay ${method} ${path} could not be reached: ${(e as Error).message}`, 0, 'unreachable');
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
    if (!res.ok) {
      const message = data?.error?.description || `Razorpay ${method} ${path} failed (${res.status})`;
      throw new RazorpayError(message, res.status, res.status === 401 ? 'credentials' : res.status >= 500 ? 'unreachable' : 'rejected');
    }
    return data as T;
  }

  planId(plan: string, cycle: string): string {
    const id = this.cfg.planIds[`${plan}_${cycle}`];
    if (!id) throw new RazorpayError(`No Razorpay plan configured for ${plan}_${cycle} (RAZORPAY_PLAN_IDS)`, 0, 'plans');
    return id;
  }

  /**
   * Proves the key is accepted and every plan JantaHR sells exists in this Razorpay account and mode. Throws a
   * RazorpayError naming the first problem. Read-only.
   */
  async verify(): Promise<void> {
    const missing = RAZORPAY_PLAN_KEYS.filter((k) => !this.cfg.planIds[k]);
    if (missing.length) throw new RazorpayError(`RAZORPAY_PLAN_IDS has no plan for ${missing.join(', ')}`, 0, 'plans');
    await Promise.all(RAZORPAY_PLAN_KEYS.map(async (k) => {
      try { await this.call('GET', `/plans/${this.cfg.planIds[k]}`); } catch (e) {
        if (e instanceof RazorpayError && e.kind === 'rejected') throw new RazorpayError(`Razorpay plan for ${k} was not found in this account or mode: ${e.message}`, e.status, 'plans');
        throw e;
      }
    }));
  }

  createSubscription(p: { plan: string; cycle: string; seats: number; notes: Record<string, string> }) {
    return this.call<{ id: string; short_url?: string; status: string }>('POST', '/subscriptions', {
      plan_id: this.planId(p.plan, p.cycle), quantity: p.seats, total_count: p.cycle === 'ANNUAL' ? 10 : 120, customer_notify: 1, notes: p.notes,
    });
  }

  update(subscriptionId: string, p: { plan?: string; cycle?: string; seats?: number; atCycleEnd: boolean }) {
    return this.call('PATCH', `/subscriptions/${subscriptionId}`, {
      ...(p.plan && p.cycle ? { plan_id: this.planId(p.plan, p.cycle) } : {}), ...(p.seats ? { quantity: p.seats } : {}), schedule_change_at: p.atCycleEnd ? 'cycle_end' : 'now',
    });
  }

  cancel(subscriptionId: string, atCycleEnd: boolean) {
    return this.call('POST', `/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 });
  }
}

/** The parts of a Razorpay subscription webhook JantaHR reads. */
export interface RazorpayWebhook {
  event: string;
  payload?: {
    /** `ended_at` is set once the subscription has actually ended: now for an immediate cancel, the cycle end otherwise. */
    subscription?: { entity?: { id: string; status?: string; quantity?: number; current_start?: number | null; current_end?: number | null; ended_at?: number | null } };
    payment?: { entity?: { id: string; amount?: number; status?: string } };
  };
}
