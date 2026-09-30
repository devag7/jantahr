import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { ProductShot } from '@/components/marketing/product-shot';

const LAW = [
  'Four labour codes, 50% wage rule', 'EPF wage ceiling ₹25,000', 'Income-tax Act 2025', 'Form 130 and Form 143',
  'DPDP Rules 2025', 'Half-yearly PT in Tamil Nadu and Kerala', '8 metro cities for HRA', 'Statutory bonus notifications of August 2026',
];

function Pill({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'outline' | 'on-dark' }) {
  const style = variant === 'primary' ? 'bg-primary text-primary-foreground' : variant === 'outline' ? 'border border-primary text-primary' : 'border border-primary-on-dark text-primary-on-dark';
  return <Link href={href} className={`inline-flex h-11 items-center rounded-full px-[22px] text-body transition-transform active:scale-[0.95] ${style}`}>{children}</Link>;
}

/** Public landing page (cloud edition). Tiles alternate Parchment / White / near-black; the colour change is the divider. */
export function Landing() {
  return (
    <>
      <MarketingNav />
      <main>
        {/* hero: parchment tile, centred stack, real product screenshot */}
        <section className="bg-background px-4 pb-20 pt-16 sm:pt-20">
          <div className="mx-auto max-w-[980px] text-center">
            <h1 className="rise text-display font-semibold sm:text-hero">Payroll that keeps up<br className="hidden sm:block" /> with Indian law.</h1>
            <p className="rise-2 mx-auto mt-5 max-w-[640px] text-tagline font-normal text-secondary-foreground sm:text-lead">PF, ESI, TDS, professional tax and labour-code wages calculated every month, with every filing deadline on one calendar.</p>
            <div className="rise-2 mt-8 flex flex-wrap items-center justify-center gap-4">
              <Pill href="/signup">Start free trial</Pill>
              <Pill href="/pricing" variant="outline">See pricing</Pill>
            </div>
          </div>
          <ProductShot src="/marketing/overview.webp" alt="JantaHR company overview: headcount, attendance today, pending approvals and statutory deadlines" width={2880} height={1800} priority className="mt-16 max-w-[1024px]" />
        </section>

        {/* compliance: dark tile */}
        <section id="compliance" className="bg-tile-1 px-4 py-20 text-white sm:py-24">
          <div className="mx-auto max-w-[980px] text-center">
            <h2 className="text-display-sm font-semibold sm:text-display">Every deadline, on one calendar.</h2>
            <p className="mx-auto mt-4 max-w-[680px] text-tagline font-normal text-on-dark-muted sm:text-lead">Salary and TDS by the 7th, EPF and ESI by the 15th, quarterly returns, bonus and final settlements, each ticked off with its challan number.</p>
          </div>
          <ProductShot src="/marketing/compliance.webp" alt="Compliance calendar listing salary, TDS, EPF, ESI and return deadlines with their status" width={2880} height={1800} className="mt-14 max-w-[1024px]" />
        </section>

        {/* payroll + self-service: two tiles side by side */}
        <section id="payroll" className="grid gap-3 bg-card p-3 md:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col overflow-hidden bg-background px-6 pt-14 text-center sm:px-10">
            <h2 className="text-display-sm font-semibold sm:text-display">Payroll in minutes.</h2>
            <p className="mx-auto mt-3 max-w-[480px] text-body text-secondary-foreground">Mid-month joiners, loss of pay from attendance, arrears and loans, then payslips, bank advice and the EPF return from the same run.</p>
            <ProductShot src="/marketing/payroll.webp" alt="A payroll run with gross pay, deductions, net pay and employer contributions for each month" width={2400} height={1500} className="mt-10 w-[112%] max-w-none translate-x-[6%]" />
          </div>
          <div className="flex flex-col overflow-hidden bg-tile-2 px-6 pt-14 text-center text-white sm:px-10">
            <h2 className="text-display-sm font-semibold sm:text-display">Self-service on any phone.</h2>
            <p className="mx-auto mt-3 max-w-[380px] text-body text-on-dark-muted">Check in with location and a selfie, apply for leave, download payslips and declare investments.</p>
            <ProductShot src="/marketing/mobile.webp" alt="Employee home screen on a phone with attendance check-in and leave balance" width={780} height={1560} className="mt-10 w-[64%] max-w-[300px]" />
          </div>
        </section>

        {/* law coverage: white tile, configurator-chip cloud */}
        <section id="law" className="bg-card px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[860px] text-center">
            <h2 className="text-display-sm font-semibold sm:text-display">Current with Indian law.</h2>
            <p className="mx-auto mt-4 max-w-[620px] text-body text-secondary-foreground">Built on central and state rules notified up to September 2026, and updated as new notifications arrive.</p>
            <ul className="mt-10 flex flex-wrap justify-center gap-3">
              {LAW.map((l) => <li key={l} className="rounded-full border px-4 py-3 text-caption">{l}</li>)}
            </ul>
          </div>
        </section>

        {/* editions: parchment tile, two utility cards */}
        <section className="bg-background px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[980px]">
            <h2 className="text-center text-display-sm font-semibold sm:text-display">Our cloud, or yours.</h2>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              <article className="flex flex-col rounded-lg border bg-card p-8">
                <h3 className="text-tagline font-semibold">JantaHR Cloud</h3>
                <p className="mt-3 flex-1 text-body text-secondary-foreground">Hosted in India on Supabase and Vercel, with backups, updates and statutory changes handled for you. Free for up to 20 employees; paid plans from ₹49 per employee a month.</p>
                <div className="mt-8"><Pill href="/signup">Start free trial</Pill></div>
              </article>
              <article className="flex flex-col rounded-lg border bg-card p-8">
                <h3 className="text-tagline font-semibold">Self-hosted</h3>
                <p className="mt-3 flex-1 text-body text-secondary-foreground">Run the complete suite on your own servers with Supabase and OrioleDB Postgres. Every feature and no employee limit, at no licence cost.</p>
                <div className="mt-8"><Pill href="/self-hosting" variant="outline">Read the setup guide</Pill></div>
              </article>
            </div>
          </div>
        </section>

        {/* closing band */}
        <section className="bg-tile-3 px-4 py-20 text-center text-white">
          <h2 className="text-display-sm font-semibold sm:text-display">Run next month&apos;s payroll here.</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-body text-on-dark-muted">The first 14 days include every Professional feature. No card needed.</p>
          <div className="mt-8"><Pill href="/signup">Start free trial</Pill></div>
        </section>
      </main>
    </>
  );
}
