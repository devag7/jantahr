// Supabase Edge Function: jobs-dispatch
// pg_cron (via pg_net) calls this on a schedule; it forwards each job to the JantaHR API with retries.
// Keeps the API URL and CRON_SECRET out of SQL, and lets serverless API deployments (Vercel) run nightly jobs.
//
// Secrets: JANTAHR_API_URL, CRON_SECRET, JOBS_DISPATCH_SECRET (shared with the pg_cron caller via Supabase Vault)

const API = (Deno.env.get('JANTAHR_API_URL') ?? '').replace(/\/$/, '');
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const DISPATCH_SECRET = Deno.env.get('JOBS_DISPATCH_SECRET') ?? '';
const KNOWN = new Set(['attendance-finalise', 'leave-accrual', 'leave-rollover', 'privacy-housekeeping', 'billing-sweep', 'billing-inbox']);

function sameSecret(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function runJob(job: string) {
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}/internal/jobs/${job}`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } });
      const body = await res.text();
      if (res.ok) return { job, ok: true, status: res.status, attempt, body: body.slice(0, 500) };
      last = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      if (res.status < 500) break; // 4xx will not fix itself
    } catch (e) {
      last = String(e);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  return { job, ok: false, error: last };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!sameSecret(req.headers.get('x-dispatch-secret') ?? '', DISPATCH_SECRET)) return new Response('Unauthorized', { status: 401 });
  if (!API || !CRON_SECRET) return Response.json({ error: 'JANTAHR_API_URL and CRON_SECRET must be set' }, { status: 500 });
  const { jobs } = (await req.json().catch(() => ({}))) as { jobs?: string[] };
  const list = (jobs ?? []).filter((j) => KNOWN.has(j));
  if (!list.length) return Response.json({ error: `Pass {"jobs": [...]}, known: ${[...KNOWN].join(', ')}` }, { status: 400 });
  const results = [];
  for (const job of list) results.push(await runJob(job));
  return Response.json({ results }, { status: results.every((r) => r.ok) ? 200 : 502 });
});
