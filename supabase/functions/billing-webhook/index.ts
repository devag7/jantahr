// Supabase Edge Function: billing-webhook
// Razorpay → this function. It verifies X-Razorpay-Signature over the raw body, stores the event in the
// "BillingEvent" inbox (idempotent on the event id) and nudges the API to apply it. If the API is cold or down the
// event is still safe in Postgres; the API's inbox job applies it later. Point Razorpay here instead of at the API
// when you want webhooks accepted at the edge.
//
// Secrets: RAZORPAY_WEBHOOK_SECRET, SUPABASE_DB_URL (provided by Supabase), JANTAHR_API_URL, CRON_SECRET
import postgres from 'npm:postgres@3.4.5';

const SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
const API = (Deno.env.get('JANTAHR_API_URL') ?? '').replace(/\/$/, '');
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const sql = postgres(Deno.env.get('SUPABASE_DB_URL') ?? '', { max: 1, prepare: false });

async function hmacHex(secret: string, body: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, body));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sameHex(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!SECRET) return new Response('RAZORPAY_WEBHOOK_SECRET not set', { status: 500 });
  const raw = new Uint8Array(await req.arrayBuffer());
  if (!sameHex(await hmacHex(SECRET, raw), req.headers.get('x-razorpay-signature') ?? '')) return new Response('Invalid signature', { status: 401 });

  const payload = JSON.parse(new TextDecoder().decode(raw));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  const id = req.headers.get('x-razorpay-event-id') ?? [...digest].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
  await sql`
    INSERT INTO public."BillingEvent" (id, provider, type, payload, "receivedVia")
    VALUES (${id}, 'razorpay', ${String(payload.event ?? 'unknown').slice(0, 80)}, ${sql.json(payload)}, 'edge')
    ON CONFLICT (id) DO NOTHING`;

  // best effort: apply now; the scheduled inbox job is the safety net
  if (API && CRON_SECRET) {
    const nudge = fetch(`${API}/internal/jobs/billing-inbox`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } }).catch(() => undefined);
    // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(nudge);
    else await nudge;
  }
  return Response.json({ received: true, id });
});
