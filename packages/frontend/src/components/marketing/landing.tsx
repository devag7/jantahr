import Link from 'next/link';
import { BarChart3, Briefcase, CalendarDays, Receipt, Target, UserPlus, type LucideIcon } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { ProductShot } from '@/components/marketing/product-shot';
import { ProductTour } from '@/components/marketing/product-tour';
import { Faq } from '@/components/marketing/faq';
import { FAQ } from '@/components/marketing/faq.constants';
import { COMPLIANCE_FACTS, LAW_CLUSTERS, RULES_CURRENT_TO, STEPS, TRUST } from '@/components/marketing/landing.constants';
import type { ShotName } from '@/components/marketing/shots';
import { PLANS, formatRupees, lowestPlanWith } from '@/lib/plans';
import { cn } from '@/lib/utils';
import type { FeatureKey } from '@/types/billing';

/** The questions the home page answers: the first five of the pricing FAQ. */
export const HOME_FAQ = FAQ.slice(0, 5);

function Pill({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'outline' | 'on-dark' }) {
  const style = variant === 'primary' ? 'bg-primary text-primary-foreground' : variant === 'outline' ? 'border border-primary text-primary' : 'border border-primary-on-dark text-primary-on-dark';
  return <Link href={href} className={`inline-flex h-11 items-center whitespace-nowrap rounded-full px-[22px] text-body transition-transform active:scale-[0.95] ${style}`}>{children}</Link>;
}

/** One cell per module in the app's navigation (nav.constants.ts); `feature` names the plan feature that gates it. */
const MODULES: { feature: FeatureKey; icon: LucideIcon; title: string; text: string; shot?: ShotName; size: 'large' | 'small' }[] = [
  { feature: 'attendance', icon: CalendarDays, title: 'Leave and attendance with geo-fenced check-in', text: 'Leave policies with accrual, encashment and comp-off, shifts and rosters, and check-in from the office radius with an optional selfie.', shot: 'attendance', size: 'large' },
  { feature: 'lifecycle', icon: UserPlus, title: 'Onboarding, exits and full and final settlement', text: 'Joining checklists, resignations, clearances, the F&F calculation and relieving letters.', size: 'small' },
  { feature: 'expenses', icon: Receipt, title: 'Expense claims and the HR helpdesk', text: 'Claims with receipts, travel requests and reimbursement, plus helpdesk tickets for HR questions.', size: 'small' },
  { feature: 'recruitment', icon: Briefcase, title: 'Recruitment and your careers page', text: 'Job openings on a public careers page, an applicant pipeline, interviews and offers, then hire in one step.', shot: 'recruitment', size: 'small' },
  { feature: 'performance', icon: Target, title: 'Performance reviews and appraisal cycles', text: 'Goals, self and manager reviews, calibration and salary revisions that flow into payroll.', size: 'small' },
  { feature: 'analytics', icon: BarChart3, title: 'Reports, analytics and attrition insights', text: 'MIS reports, a custom report builder, and attrition and anomaly insights.', size: 'small' },
];

/** "Every plan" for a feature the Free plan has; otherwise the first paid plan that includes it. */
function planLabel(feature: FeatureKey) {
  const plan = lowestPlanWith(feature);
  if (!plan) return null;
  return plan.key === 'FREE' ? 'Every plan, including Free' : `${plan.name} plan and above`;
}

/** Public landing page (cloud edition). Tiles alternate Parchment / White / near-black; the colour change is the divider. */
export function Landing() {
  const free = PLANS.find((p) => p.key === 'FREE');
  return (
    <>
      <MarketingNav />
      <main>
        {/* hero: parchment tile, centred stack, a four-view product tour */}
        <section className="bg-background px-4 pb-16 pt-12 sm:pb-20 sm:pt-20">
          <div className="mx-auto max-w-[980px] text-center">
            <h1 className="rise text-display font-semibold sm:text-hero">Payroll that keeps up<br className="hidden sm:block" /> with Indian law.</h1>
            <p className="rise-2 mx-auto mt-5 max-w-[640px] text-tagline font-normal text-secondary-foreground sm:text-lead">PF, ESI, TDS, professional tax and labour-code wages calculated every month, with every filing deadline on one calendar.</p>
            <div className="rise-2 mt-8 flex flex-wrap items-center justify-center gap-4">
              <Pill href="/signup">Start free trial</Pill>
              <Pill href="/pricing" variant="outline">See pricing</Pill>
            </div>
          </div>
          <ProductTour />
        </section>

        {/* trust strip: plain facts, no cards */}
        <section aria-label="At a glance" className="bg-card px-4 py-7">
          {/* one row where it fits (1280+), a centred 2 x 2 block below that, a column on small phones */}
          <ul className="mx-auto grid w-fit grid-cols-1 gap-x-12 gap-y-3 sm:grid-cols-2 xl:flex xl:w-auto xl:justify-center xl:gap-12">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 whitespace-nowrap text-body text-secondary-foreground"><Icon className="h-5 w-5 shrink-0 text-foreground" aria-hidden />{text}</li>
            ))}
          </ul>
        </section>

        {/* compliance: dark tile */}
        <section id="compliance" className="bg-tile-1 px-4 py-20 text-white sm:py-24">
          <div className="mx-auto max-w-[980px] text-center">
            <h2 className="text-display-sm font-semibold sm:text-display">Every deadline, on one calendar.</h2>
            <p className="mx-auto mt-4 max-w-[680px] text-tagline font-normal text-on-dark-muted sm:text-lead">Salary and TDS by the 7th, EPF and ESI by the 15th, quarterly returns, bonus and final settlements, each ticked off with its challan number.</p>
            <dl className="mx-auto mt-10 grid max-w-[760px] gap-6 text-center sm:grid-cols-3">
              {COMPLIANCE_FACTS.map((f) => (
                <div key={f.title}><dt className="text-body-strong">{f.title}</dt><dd className="mt-1 text-body text-on-dark-muted">{f.detail}</dd></div>
              ))}
            </dl>
          </div>
          <ProductShot name="compliance" className="mt-14 max-w-[1024px]" />
        </section>

        {/* payroll + self-service: two tiles side by side */}
        <section id="payroll" className="grid gap-3 bg-card p-3 md:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col overflow-hidden bg-background px-6 pt-14 text-center sm:px-10">
            <h2 className="text-display-sm font-semibold sm:text-display">Payroll in minutes.</h2>
            <p className="mx-auto mt-3 max-w-[480px] text-body text-secondary-foreground">Mid-month joiners, loss of pay from attendance, arrears and loans, then payslips, bank advice and the EPF return from the same run.</p>
            <ProductShot name="payroll" sizes="(max-width: 768px) 112vw, 760px" className="mt-10 w-[112%] max-w-none translate-x-[6%]" />
          </div>
          <div className="flex flex-col overflow-hidden bg-tile-2 px-6 pt-14 text-center text-white sm:px-10">
            <h2 className="text-display-sm font-semibold sm:text-display">Self-service on any phone.</h2>
            <p className="mx-auto mt-3 max-w-[380px] text-body text-on-dark-muted">Check in with location and a selfie, apply for leave, download payslips and declare investments.</p>
            <ProductShot name="mobile" sizes="(max-width: 768px) 64vw, 300px" className="mt-10 w-[64%] max-w-[300px]" />
          </div>
        </section>

        {/* everything around payroll: bento, one cell per module */}
        <section id="modules" className="bg-background px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[1024px]">
            <div className="mx-auto max-w-[720px] text-center">
              <h2 className="text-display-sm font-semibold sm:text-display">Everything around payroll.</h2>
              <p className="mt-4 text-body text-secondary-foreground">Leave, attendance, hiring, exits and reviews run on the same employee records as payroll, so nothing is typed twice.</p>
            </div>
            <ul className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => {
                const label = planLabel(m.feature);
                return (
                  <li key={m.feature} className={cn('flex flex-col overflow-hidden rounded-lg border bg-card', m.size === 'large' ? 'md:col-span-2 lg:row-span-2' : '')}>
                    <div className="p-6 sm:p-7">
                      <m.icon className="h-6 w-6 text-foreground" aria-hidden />
                      <h3 className={cn('mt-4 font-semibold', m.size === 'large' ? 'text-tagline' : 'text-body-strong')}>{m.title}</h3>
                      <p className="mt-2 text-body text-secondary-foreground">{m.text}</p>
                      {label && <p className="mt-3 text-fine text-muted-foreground">{label}</p>}
                    </div>
                    {m.shot && (
                      <div className={cn('mt-auto px-6 sm:px-7', m.size === 'large' ? 'pb-0' : 'max-h-[180px] overflow-hidden')}>
                        <ProductShot name={m.shot} sizes={m.size === 'large' ? '(max-width: 1024px) 92vw, 640px' : '(max-width: 768px) 92vw, 320px'} imgClassName="rounded-b-none" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* how it works: three verbs, a row on desktop and a column on phones */}
        <section className="bg-card px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[980px]">
            <h2 className="text-center text-display-sm font-semibold sm:text-display">From sign-up to payslips.</h2>
            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((s) => (
                <li key={s.title}>
                  <h3 className="text-tagline font-semibold">{s.title}</h3>
                  <p className="mt-2 text-body text-secondary-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* law coverage: parchment tile, chips grouped by area */}
        <section id="law" className="bg-background px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[1024px]">
            <div className="mx-auto max-w-[720px] text-center">
              <h2 className="text-display-sm font-semibold sm:text-display">Current with Indian law.</h2>
              <p className="mt-4 text-body text-secondary-foreground">Built on central and state rules notified up to {RULES_CURRENT_TO}, and updated as new notifications arrive.</p>
            </div>
            <div className="mx-auto mt-12 grid max-w-[860px] gap-x-12 gap-y-8 md:grid-cols-2">
              {LAW_CLUSTERS.map((c) => (
                <div key={c.title}>
                  <h3 className="text-caption-strong text-muted-foreground">{c.title}</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {c.items.map((l) => <li key={l} className="rounded-full border bg-card px-4 py-2.5 text-caption sm:whitespace-nowrap">{l}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* pricing teaser: one row, numbers from the plan catalogue */}
        <section className="bg-card px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[1024px]">
            <div className="mx-auto max-w-[720px] text-center">
              <h2 className="text-display-sm font-semibold sm:text-display">Priced per employee.</h2>
              <p className="mt-4 text-body text-secondary-foreground">{free?.maxEmployees ? `Free for up to ${free.maxEmployees} employees. ` : ''}Paid plans are a monthly price for each active employee.</p>
            </div>
            <ul className="mt-12 grid divide-y rounded-lg border bg-background sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
              {PLANS.map((p, i) => (
                <li key={p.key} className={cn('px-6 py-6', i % 2 === 1 && 'sm:border-l lg:border-l-0', i >= 2 && 'sm:border-t lg:border-t-0')}>
                  <h3 className="text-body-strong">{p.name}</h3>
                  <p className="mt-3 text-display-sm font-semibold tabular">{p.pricePaise ? formatRupees(p.pricePaise.ANNUAL) : 'Custom'}</p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {!p.pricePaise ? `From ${p.minSeats} employees` : p.pricePaise.ANNUAL > 0 ? 'Per employee a month, billed yearly' : p.maxEmployees ? `Up to ${p.maxEmployees} employees` : 'No charge'}
                  </p>
                  <p className="mt-3 text-caption text-secondary-foreground">{p.summary}</p>
                </li>
              ))}
            </ul>
            <div className="mt-10 text-center"><Pill href="/pricing" variant="outline">See pricing</Pill></div>
          </div>
        </section>

        {/* questions: reused from the pricing page */}
        <section className="bg-background px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-center text-display-sm font-semibold sm:text-display">Questions</h2>
            <div className="mt-10"><Faq items={HOME_FAQ} /></div>
          </div>
        </section>

        {/* editions: white tile, two utility cards */}
        <section className="bg-card px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-[980px]">
            <h2 className="text-center text-display-sm font-semibold sm:text-display">Our cloud, or yours.</h2>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              <article className="flex flex-col rounded-lg border bg-background p-8">
                <h3 className="text-tagline font-semibold">JantaHR Cloud</h3>
                <p className="mt-3 flex-1 text-body text-secondary-foreground">Hosted in India on Supabase and Vercel, with backups, updates and statutory changes handled for you. Free for up to 20 employees; paid plans from ₹49 per employee a month.</p>
                <div className="mt-8"><Pill href="/signup">Start free trial</Pill></div>
              </article>
              <article className="flex flex-col rounded-lg border bg-background p-8">
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
