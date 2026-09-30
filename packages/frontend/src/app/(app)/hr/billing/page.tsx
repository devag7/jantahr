'use client';
import * as React from 'react';
import { Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/common/data-table';
import { DownloadButton } from '@/components/common/download-button';
import { ConfirmModal, Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { openRazorpay } from '@/components/billing/razorpay';
import { useAuth } from '@/hooks/auth/use-auth';
import { useBillingOverview, useCancelSubscription, useChangeSeats, useCheckout, useConfirmCheckout } from '@/hooks/billing/use-billing';
import { errorMessage } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { billingService } from '@/services/billing/billing.service';
import type { BillingOverview, Cycle, PlanDef } from '@/types/billing';

/** Whole rupees without decimals; otherwise always two decimals (₹2,138.40, never ₹2,138.4). */
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', paise % 100 === 0 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS: Record<string, [string, string]> = {
  TRIALING: ['PENDING', 'Trial'], ACTIVE: ['ACTIVE', 'Active'], PAST_DUE: ['REJECTED', 'Payment failed'], HALTED: ['REJECTED', 'Halted'], CANCELLED: ['CANCELLED', 'Cancelled'], EXPIRED: ['CANCELLED', 'Ended'],
};

export default function BillingPage() {
  const q = useBillingOverview();
  return (
    <>
      <PageHeader title="Billing" description="Your plan, seats and GST invoices." />
      <QueryBoundary query={q} rows={6}>{(d) => (d.edition === 'self_hosted' ? <SelfHosted /> : <Cloud d={d} />)}</QueryBoundary>
    </>
  );
}

function SelfHosted() {
  return (
    <Card>
      <CardHeader><CardTitle>Self-hosted edition</CardTitle><CardDescription>This installation runs on your own infrastructure.</CardDescription></CardHeader>
      <CardContent className="text-body text-secondary-foreground">Every module is included with no employee limit and no subscription. There is nothing to buy here.</CardContent>
    </Card>
  );
}

function Cloud({ d }: { d: BillingOverview }) {
  const { user } = useAuth();
  const owner = user?.role === 'SUPER_ADMIN';
  const sub = d.subscription;
  const ent = d.entitlements;
  const paid = sub && sub.plan !== 'FREE' && ['ACTIVE', 'PAST_DUE', 'CANCELLED'].includes(sub.status);
  const [status, label] = STATUS[sub?.status ?? 'ACTIVE'] ?? ['ACTIVE', 'Active'];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Plan" value={ent.plan === 'SELF_HOSTED' ? 'Self-hosted' : d.plans.find((p) => p.key === ent.plan)?.name ?? ent.plan} hint={<StatusBadge status={status} label={label} />} />
        <StatCard label="Employees" value={d.usage.activeEmployees} hint={d.usage.seatLimit ? `of ${d.usage.seatLimit} seats` : 'No seat limit'} tone={d.usage.seatLimit && d.usage.activeEmployees >= d.usage.seatLimit ? 'warning' : 'default'} />
        <StatCard label={sub?.status === 'TRIALING' ? 'Trial ends' : 'Renews'} value={sub?.status === 'TRIALING' ? (sub.trialEndsAt ? formatDate(sub.trialEndsAt) : '-') : sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : '-'} hint={sub?.cancelAtPeriodEnd ? 'Will not renew' : sub?.cycle === 'ANNUAL' ? 'Billed yearly' : paid ? 'Billed monthly' : undefined} />
        <StatCard label="Payments" value={d.provider === 'razorpay' ? 'Razorpay' : d.provider === 'mock' ? 'Test mode' : 'Not set up'} hint={d.provider === 'mock' ? 'Development payments, no money moves' : undefined} />
      </div>

      {owner && d.provider && (paid ? <ManagePlan d={d} /> : <ChoosePlan d={d} />)}
      {!owner && <p className="text-caption text-muted-foreground">Only the account owner (Super admin) can change the plan.</p>}
      {!d.provider && owner && <p className="text-caption text-muted-foreground">Online payments are not configured on this server. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_PLAN_IDS on the API.</p>}

      <section>
        <h2 className="mb-4 text-tagline font-semibold">Invoices</h2>
        <DataTable rows={d.invoices} rowKey={(i) => i.id} emptyTitle="No invoices yet" emptyDescription="A GST tax invoice appears here after every payment."
          columns={[
            { key: 'n', header: 'Invoice', cell: (i) => <span className="font-semibold tabular">{i.number}</span> },
            { key: 'd', header: 'Date', cell: (i) => formatDate(i.issuedAt) },
            { key: 'p', header: 'Plan', cell: (i) => `${d.plans.find((p) => p.key === i.plan)?.name ?? i.plan}, ${i.seats} seats`, hideOnMobile: true },
            { key: 'g', header: 'GST', align: 'right', cell: (i) => <span className="tabular">{rupees(i.cgstPaise + i.sgstPaise + i.igstPaise)}</span>, hideOnMobile: true },
            { key: 't', header: 'Total', align: 'right', cell: (i) => <span className="font-semibold tabular">{rupees(i.totalPaise)}</span> },
            { key: 'x', header: '', align: 'right', cell: (i) => <DownloadButton size="sm" variant="ghost" icon={false} onDownload={() => billingService.invoicePdf(i.id, i.number)}><Download className="h-4 w-4" /><span className="sr-only">Download {i.number}</span></DownloadButton> },
          ]} />
      </section>
    </div>
  );
}

function ChoosePlan({ d }: { d: BillingOverview }) {
  const { user } = useAuth();
  const buyable = d.plans.filter((p): p is PlanDef & { pricePaise: NonNullable<PlanDef['pricePaise']> } => !!p.pricePaise && p.key !== 'FREE' && p.key !== 'ENTERPRISE');
  const [plan, setPlan] = React.useState(() => {
    const wanted = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null;
    return buyable.find((p) => p.key === wanted)?.key ?? buyable[0]?.key ?? 'STANDARD';
  });
  const [cycle, setCycle] = React.useState<Cycle>('ANNUAL');
  const def = buyable.find((p) => p.key === plan)!;
  const min = Math.max(def.minSeats, d.usage.activeEmployees);
  const [seats, setSeats] = React.useState(String(Math.max(min, 10)));
  const checkout = useCheckout();
  const confirm = useConfirmCheckout();
  const [busy, setBusy] = React.useState(false);
  const n = Math.max(min, Number(seats) || min);
  const taxable = def.pricePaise[cycle] * n * (cycle === 'ANNUAL' ? 12 : 1);

  const buy = async () => {
    setBusy(true);
    try {
      const co = await checkout.mutateAsync({ plan: plan as 'STANDARD' | 'PROFESSIONAL', cycle, seats: n });
      if (co.provider === 'razorpay') {
        const r = await openRazorpay({ key: co.razorpayKeyId!, subscriptionId: co.subscriptionId, name: co.prefill.name, email: co.prefill.email || user?.email || '', description: `${def.name}, ${n} employees` });
        await confirm.mutateAsync(r);
      } else await confirm.mutateAsync({});
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Choose a plan</CardTitle><CardDescription>Prices are per employee per month, before 18% GST.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
          {buyable.map((p) => (
            <button key={p.key} role="radio" aria-checked={plan === p.key} onClick={() => { setPlan(p.key); }}
              className={cn('rounded-lg border p-5 text-left transition-colors', plan === p.key ? 'border-2 border-ring p-[19px]' : 'hover:border-foreground/30')}>
              <span className="flex items-baseline justify-between gap-3"><span className="text-body font-semibold">{p.name}</span><span className="text-body tabular">{rupees(p.pricePaise[cycle])}</span></span>
              <span className="mt-1 block text-caption text-muted-foreground">{p.summary}</span>
              <ul className="mt-3 space-y-1">{p.highlights.slice(1, 4).map((h) => <li key={h} className="flex gap-2 text-caption"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />{h}</li>)}</ul>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div role="radiogroup" aria-label="Billing cycle" className="inline-flex rounded-full bg-divider p-1">
            {(['MONTHLY', 'ANNUAL'] as Cycle[]).map((c) => (
              <button key={c} role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)}
                className={cn('h-9 rounded-full border px-5 text-caption', cycle === c ? 'border-border bg-card font-semibold' : 'border-transparent text-muted-foreground')}>{c === 'MONTHLY' ? 'Monthly' : 'Yearly, save 17%'}</button>
            ))}
          </div>
          <label className="flex flex-col gap-2 text-caption font-semibold">Seats
            <Input type="number" min={min} value={seats} onChange={(e) => setSeats(e.target.value)} className="w-32" aria-describedby="seats-hint" />
          </label>
          <p id="seats-hint" className="pb-3 text-fine text-muted-foreground">At least {min} ({d.usage.activeEmployees} active employees)</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-divider pt-5">
          <p className="text-body"><span className="font-semibold tabular">{rupees(Math.round(taxable * 1.18))}</span> <span className="text-muted-foreground">{cycle === 'ANNUAL' ? 'a year' : 'a month'} including GST ({rupees(taxable)} + {rupees(Math.round(taxable * 0.18))})</span></p>
          <Button onClick={buy} disabled={busy}>{busy && <Spinner />}{d.provider === 'mock' ? 'Activate (test mode)' : 'Continue to payment'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagePlan({ d }: { d: BillingOverview }) {
  const sub = d.subscription!;
  const seatsMut = useChangeSeats();
  const cancel = useCancelSubscription();
  const [seatsOpen, setSeatsOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [seats, setSeats] = React.useState(String(sub.seats));
  const cancelled = sub.status === 'CANCELLED';
  return (
    <Card>
      <CardHeader><CardTitle>{d.plans.find((p) => p.key === sub.plan)?.name} plan</CardTitle><CardDescription>{sub.seats} seats, billed {sub.cycle === 'ANNUAL' ? 'yearly' : 'monthly'}{sub.pendingSeats ? `; ${sub.pendingSeats} seats from the next renewal` : ''}.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {!cancelled && <Button variant="outline" onClick={() => setSeatsOpen(true)}>Change seats</Button>}
        {!cancelled && <Button variant="ghost" className="text-destructive" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>}
        {cancelled && <p className="text-body text-muted-foreground">Paid features stay on until {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd, false) : 'the end of the period'}. Afterwards the company moves to Free and paid modules become read-only.</p>}
      </CardContent>
      <Modal open={seatsOpen} onOpenChange={setSeatsOpen} title="Change seats" description="Adding seats applies now and is pro-rated. Removing seats applies at renewal.">
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); seatsMut.mutate(Number(seats), { onSuccess: () => setSeatsOpen(false) }); }}>
          <label className="flex flex-col gap-2 text-caption font-semibold">Seats<Input type="number" min={Math.max(10, d.usage.activeEmployees)} value={seats} onChange={(e) => setSeats(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSeatsOpen(false)}>Close</Button><Button type="submit" disabled={seatsMut.isPending}>{seatsMut.isPending && <Spinner />}Save</Button></div>
        </form>
      </Modal>
      <ConfirmModal open={cancelOpen} onOpenChange={setCancelOpen} destructive title="Cancel the subscription?" description="It will not renew. Paid features stay on until the end of the current period; no data is deleted." confirmLabel="Cancel subscription" loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setCancelOpen(false) })} />
    </Card>
  );
}
