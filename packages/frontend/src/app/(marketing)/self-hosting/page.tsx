import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/marketing-nav';

export const metadata: Metadata = { title: 'Self-hosting', description: 'Run JantaHR on your own servers with Supabase and OrioleDB Postgres.' };

const STACK = [
  ['Postgres 17 with OrioleDB', 'Supabase’s Postgres image with the OrioleDB storage engine as the default for every table.'],
  ['Supabase Storage', 'Documents, receipts, résumés and selfies through the S3-compatible endpoint, in a private bucket.'],
  ['Supabase Realtime', 'Notifications arrive in the browser the moment they are created.'],
  ['Supabase Auth', 'Optional Google and magic-link sign-in, mapped to existing JantaHR accounts.'],
  ['Edge Functions', 'Scheduled job dispatch and payment webhooks, running on the Supabase edge runtime.'],
  ['Studio, PostgREST, Supavisor', 'Database admin, the auto-generated API (locked down by row-level security) and connection pooling.'],
];

const STEPS: { title: string; code: string }[] = [
  { title: 'Get the code and generate secrets', code: 'cd deploy/self-hosted\n./jantahr.sh setup' },
  { title: 'Review the settings', code: '# .env: SITE_URL, SUPABASE_PUBLIC_URL, JANTAHR_WEB_URL,\n# JANTAHR_API_PUBLIC_URL, SMTP_*, DASHBOARD_PASSWORD' },
  { title: 'Start everything', code: './jantahr.sh up\n# web  http://localhost:3000\n# API  http://localhost:3002\n# Studio  http://localhost:8000' },
];

export default function SelfHostingPage() {
  return (
    <>
      <MarketingNav title="Self-hosting" />
      <main className="bg-card">
        <section className="bg-background px-4 pb-20 pt-16 text-center">
          <h1 className="mx-auto max-w-[820px] text-display font-semibold sm:text-hero">The whole suite, on your servers.</h1>
          <p className="mx-auto mt-4 max-w-[640px] text-tagline font-normal text-secondary-foreground sm:text-lead">One command starts JantaHR with a complete Supabase stack. Every feature, no employee limit, no licence fee.</p>
        </section>
        <section className="px-4 py-20">
          <div className="mx-auto grid max-w-[980px] gap-x-10 gap-y-8 sm:grid-cols-2">
            {STACK.map(([t, d]) => (
              <div key={t} className="border-t pt-5">
                <h2 className="text-body font-semibold">{t}</h2>
                <p className="mt-1.5 text-body text-secondary-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-tile-1 px-4 py-20 text-white">
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-center text-display-sm font-semibold sm:text-display">Three steps.</h2>
            <ol className="mt-12 space-y-8">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <p className="text-body font-semibold">{i + 1}. {s.title}</p>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-5 text-caption leading-relaxed text-on-dark-muted"><code>{s.code}</code></pre>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-body text-on-dark-muted">Needs Docker with about 8 GB of free disk. Back up <code className="text-white">JANTAHR_ENCRYPTION_KEY</code>: without it, encrypted PAN, Aadhaar and bank numbers cannot be read. The full guide is in <code className="text-white">deploy/self-hosted/README.md</code>.</p>
          </div>
        </section>
      </main>
    </>
  );
}
