'use client';
import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { FEATURE_LABELS, PLANS, TRIAL_DAYS } from '@/lib/plans';
import { SALES_EMAIL } from '@/lib/edition';
import { cn } from '@/lib/utils';
import type { Cycle, FeatureKey, PlanDef } from '@/types/billing';

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const GROUPS: { title: string; features: FeatureKey[] }[] = [
  { title: 'Every plan', features: ['core', 'leave', 'attendance', 'selfService', 'privacy'] },
  { title: 'Payroll and compliance', features: ['payroll', 'statutory', 'lifecycle', 'expenses', 'helpdesk'] },
  { title: 'Growth', features: ['performance', 'recruitment', 'analytics', 'aiAssistant', 'biometric', 'googleSignIn'] },
];

function monthlyTotal(p: PlanDef, cycle: Cycle, employees: number) {
  if (!p.pricePaise) return null;
  const seats = Math.max(p.minSeats, employees);
  return p.pricePaise[cycle] * seats;
}

export function PricingPlans() {
  const [cycle, setCycle] = React.useState<Cycle>('ANNUAL');
  const [employees, setEmployees] = React.useState(50);
  const paid = PLANS.filter((p) => p.key !== 'FREE');
  const free = PLANS.find((p) => p.key === 'FREE')!;
  return (
    <>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
        <div role="radiogroup" aria-label="Billing cycle" className="inline-flex rounded-full bg-divider p-1">
          {(['MONTHLY', 'ANNUAL'] as Cycle[]).map((c) => (
            <button key={c} role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)}
              className={cn('h-9 rounded-full border px-5 text-caption transition-colors', cycle === c ? 'border-border bg-card font-semibold' : 'border-transparent text-muted-foreground')}>
              {c === 'MONTHLY' ? 'Monthly' : 'Yearly, save 17%'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-caption">
          Employees
          <input type="number" min={1} max={100000} value={employees} onChange={(e) => setEmployees(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))}
            className="h-11 w-28 rounded-full border border-input bg-card px-5 text-body tabular focus-visible:border-ring focus-visible:outline-none" />
        </label>
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
                    <p><span className="text-display font-semibold">{inr(p.pricePaise[cycle])}</span><span className="ml-1 text-caption text-muted-foreground">per employee a month</span></p>
                    <p className="mt-2 text-caption text-muted-foreground tabular">{inr(total!)} a month for {Math.max(p.minSeats, employees)} employees{cycle === 'ANNUAL' ? ', billed yearly' : ''}, plus GST</p>
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
          <p className="mt-2 text-caption text-muted-foreground">Every feature, no employee limit, on your own servers with Supabase and OrioleDB Postgres. <Link href="/self-hosting" className="text-primary hover:underline">Setup guide</Link></p>
        </article>
      </div>
      <p className="mt-6 text-center text-caption text-muted-foreground">Paid plans start with a {TRIAL_DAYS}-day trial of Professional. You pay for active employees; people who have left are free.</p>

      <details className="group mt-20 rounded-lg border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-8 py-6 text-tagline font-semibold">Compare every feature<span className="text-primary transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
        <div className="overflow-x-auto px-8 pb-8">
          <table className="w-full min-w-[640px] text-caption">
            <thead><tr><th className="py-3 text-left font-semibold text-muted-foreground">Feature</th>{PLANS.map((p) => <th key={p.key} className="px-3 py-3 font-semibold">{p.name}</th>)}</tr></thead>
            {GROUPS.map((g) => (
              <tbody key={g.title}>
                <tr><th colSpan={PLANS.length + 1} className="pb-2 pt-6 text-left text-caption font-semibold">{g.title}</th></tr>
                {g.features.map((f) => (
                  <tr key={f}>
                    <td className="py-2 pr-4 text-secondary-foreground">{FEATURE_LABELS[f]}</td>
                    {PLANS.map((p) => <td key={p.key} className="px-3 py-2 text-center">{p.features.includes(f) ? <Check className="mx-auto h-4 w-4 text-primary" aria-label="Included" /> : <span className="sr-only">Not included</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>
    </>
  );
}
