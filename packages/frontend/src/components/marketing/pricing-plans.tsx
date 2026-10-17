'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, Minus } from 'lucide-react';
import { FEATURE_LABELS, PLANS, TRIAL_DAYS, formatRupees } from '@/lib/plans';
import { SALES_EMAIL } from '@/lib/edition';
import { CHARGES_GST } from '@/lib/operator';
import { cn } from '@/lib/utils';
import type { Cycle, FeatureKey, PlanDef } from '@/types/billing';
import { DEFAULTS, EMPLOYEES_MAX, EMPLOYEES_MIN, parseEmployees, readParams, toQuery } from './pricing.params';

const GROUPS: { title: string; features: FeatureKey[] }[] = [
  { title: 'Every plan', features: ['core', 'leave', 'attendance', 'selfService', 'privacy', 'googleSignIn'] },
  { title: 'Payroll and compliance', features: ['payroll', 'statutory', 'lifecycle', 'expenses', 'helpdesk'] },
  { title: 'Growth', features: ['performance', 'recruitment', 'analytics', 'aiAssistant', 'biometric'] },
];

function monthlyTotal(p: PlanDef, cycle: Cycle, employees: number) {
  if (!p.pricePaise) return null;
  const seats = Math.max(p.minSeats, employees);
  return p.pricePaise[cycle] * seats;
}

/** Plans, the calculator and the feature comparison. Reads and writes ?billing=…&employees=… (see pricing.params). */
export function PricingPlans() {
  // the static page renders the defaults; the address's values replace them once the page is interactive
  return <React.Suspense fallback={<Plans initial={DEFAULTS} />}><PlansFromUrl /></React.Suspense>;
}

function PlansFromUrl() {
  const params = useSearchParams();
  const initial = React.useMemo(() => readParams(params), []); // eslint-disable-line react-hooks/exhaustive-deps -- read once; afterwards the page writes the address
  return <Plans initial={initial} sync />;
}

function Plans({ initial, sync }: { initial: { cycle: Cycle; employees: number }; sync?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [cycle, setCycle] = React.useState<Cycle>(initial.cycle);
  const [employees, setEmployees] = React.useState(initial.employees);
  const [draft, setDraft] = React.useState(String(initial.employees));
  const [error, setError] = React.useState<string | null>(null);
  const touched = React.useRef(false);

  React.useEffect(() => {
    if (!sync || !touched.current) return;
    router.replace(`${pathname}${toQuery(cycle, employees)}`, { scroll: false });
  }, [sync, cycle, employees, pathname, router]);

  const chooseCycle = (c: Cycle) => { touched.current = true; setCycle(c); };
  const onEmployees = (raw: string) => {
    setDraft(raw);
    const parsed = parseEmployees(raw);
    setError(parsed.error);
    if (parsed.value !== null) { touched.current = true; setEmployees(parsed.value); }
  };

  const paid = PLANS.filter((p) => p.key !== 'FREE');
  const free = PLANS.find((p) => p.key === 'FREE')!;
  return (
    <>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
        <div role="radiogroup" aria-label="Billing cycle" className="inline-flex rounded-full bg-divider p-1 dark:bg-muted">
          {(['MONTHLY', 'ANNUAL'] as Cycle[]).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => chooseCycle(c)}
              className={cn('h-9 rounded-full border px-5 text-caption transition-colors', cycle === c ? 'border-border bg-card font-semibold' : 'border-transparent text-secondary-foreground hover:text-foreground')}>
              {c === 'MONTHLY' ? 'Monthly' : 'Yearly, save 17%'}
            </button>
          ))}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <label htmlFor="employees" className="text-caption">Employees</label>
            <input id="employees" name="employees" type="text" inputMode="numeric" autoComplete="off" value={draft} onChange={(e) => onEmployees(e.target.value)}
              aria-invalid={!!error} aria-describedby={error ? 'employees-error' : 'employees-hint'}
              className={cn('h-11 w-28 rounded-full border bg-card px-5 text-body tabular focus-visible:border-ring focus-visible:outline-none', error ? 'border-destructive' : 'border-input')} />
          </div>
          {error
            ? <p id="employees-error" role="alert" className="mt-1.5 text-fine text-destructive">{error}</p>
            : <p id="employees-hint" className="mt-1.5 text-fine text-muted-foreground">{EMPLOYEES_MIN} to {EMPLOYEES_MAX.toLocaleString('en-IN')}</p>}
        </div>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {paid.map((p) => {
          const total = monthlyTotal(p, cycle, employees);
          return (
            <article key={p.key} className="flex flex-col rounded-lg border bg-card p-8">
              <h2 className="text-tagline font-semibold">{p.name}</h2>
              <p className="mt-2 text-caption text-muted-foreground">{p.summary}</p>
              <div className="mt-6 min-h-[88px]">
                {p.pricePaise ? (
                  <>
                    <p><span className="text-display font-semibold tabular">{formatRupees(p.pricePaise[cycle])}</span><span className="ml-1 text-caption text-muted-foreground">per employee a month</span></p>
                    <p className="mt-2 text-caption text-muted-foreground tabular">{formatRupees(total!)} a month for {Math.max(p.minSeats, employees).toLocaleString('en-IN')} employees{cycle === 'ANNUAL' ? ', billed yearly' : ''}{CHARGES_GST ? ', plus GST' : ''}</p>
                  </>
                ) : (
                  <>
                    <p className="text-display font-semibold">Custom</p>
                    <p className="mt-2 text-caption text-muted-foreground">From {p.minSeats} employees, billed yearly</p>
                  </>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.highlights.map((h) => <li key={h} className="flex gap-2.5 text-caption"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{h}</li>)}
              </ul>
              <div className="mt-8">
                {p.pricePaise
                  ? <Link href={`/signup?plan=${p.key}&cycle=${cycle}`} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-body text-primary-foreground transition-transform active:scale-[0.95]">Start free trial</Link>
                  : <a href={`mailto:${SALES_EMAIL}?subject=JantaHR Enterprise`} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-primary text-body text-primary transition-transform active:scale-[0.95]">Contact sales</a>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <article className="rounded-lg border bg-card p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-tagline font-semibold">{free.name}</h2>
            <p className="text-tagline font-semibold">₹0</p>
          </div>
          <p className="mt-2 text-caption text-muted-foreground">{free.summary} Up to {free.maxEmployees} employees, forever. Upgrade any time without moving data.</p>
        </article>
        <article id="self-hosted" className="rounded-lg border bg-card p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-tagline font-semibold">Self-hosted</h2>
            <p className="text-tagline font-semibold">₹0</p>
          </div>
          <p className="mt-2 text-caption text-muted-foreground">Every feature, no employee limit, on your own servers with Supabase and OrioleDB Postgres. <Link href="/self-hosting" className="text-primary underline underline-offset-2">Setup guide</Link></p>
        </article>
      </div>
      <p className="mt-6 text-center text-caption text-muted-foreground">Paid plans start with a {TRIAL_DAYS}-day trial of Professional. You pay for active employees; people who have left are free.</p>

      <details className="group mt-20 rounded-lg border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-6 text-tagline font-semibold sm:px-8 [&::-webkit-details-marker]:hidden">Compare every feature<span className="text-primary transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden>+</span></summary>
        <ComparisonTable />
        <ComparisonCards />
      </details>
    </>
  );
}

const Included = ({ yes }: { yes: boolean }) => yes
  ? <><Check className="mx-auto h-4 w-4 text-primary" aria-hidden /><span className="sr-only">Included</span></>
  : <><Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden /><span className="sr-only">Not included</span></>;

/** Tablets and up: one table, plan names stay in view below the site header while the rows scroll. */
function ComparisonTable() {
  return (
    <div className="hidden px-8 pb-8 md:block">
      <table className="w-full border-separate border-spacing-0 text-caption">
        <caption className="sr-only">Features in each plan</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky top-[96px] z-10 border-b bg-card py-3 text-left font-semibold text-muted-foreground">Feature</th>
            {PLANS.map((p) => <th key={p.key} scope="col" className="sticky top-[96px] z-10 w-[14%] border-b bg-card px-3 py-3 text-center font-semibold">{p.name}</th>)}
          </tr>
        </thead>
        {GROUPS.map((g) => (
          <tbody key={g.title}>
            <tr><th scope="colgroup" colSpan={PLANS.length + 1} className="pb-2 pt-6 text-left text-caption-strong">{g.title}</th></tr>
            {g.features.map((f) => (
              <tr key={f} className="hover:bg-muted/60">
                <th scope="row" className="border-b border-divider py-2.5 pr-4 text-left font-normal text-secondary-foreground">{FEATURE_LABELS[f]}</th>
                {PLANS.map((p) => <td key={p.key} className="border-b border-divider px-3 py-2.5 text-center"><Included yes={p.features.includes(f)} /></td>)}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Phones: one card per plan listing what it includes, instead of a table that scrolls sideways. */
function ComparisonCards() {
  return (
    <div className="space-y-4 px-4 pb-4 md:hidden">
      {PLANS.map((p) => (
        <section key={p.key} aria-label={`${p.name} plan`} className="rounded-lg border bg-background p-5">
          <h3 className="text-body-strong">{p.name}</h3>
          {GROUPS.map((g) => {
            const has = g.features.filter((f) => p.features.includes(f));
            return has.length ? (
              <div key={g.title} className="mt-4">
                <p className="text-fine font-semibold text-muted-foreground">{g.title}</p>
                <ul className="mt-2 space-y-2">{has.map((f) => <li key={f} className="flex gap-2.5 text-caption"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{FEATURE_LABELS[f]}</li>)}</ul>
              </div>
            ) : null;
          })}
        </section>
      ))}
    </div>
  );
}
