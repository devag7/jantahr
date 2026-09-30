'use client';
import * as React from 'react';
import { Plane, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { ConfirmModal, Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { ExpenseClaimModal } from '@/components/expenses/expense-form';
import { useClaims, useCreateTravel, useDeleteClaim, useSubmitClaim, useTravel } from '@/hooks/expenses/use-expenses';
import { formatDate, formatINR, todayISO } from '@/lib/format';
import type { ExpenseClaim } from '@/types/expenses';

export default function MyExpensesPage() {
  const [claimOpen, setClaimOpen] = React.useState(false);
  const [travelOpen, setTravelOpen] = React.useState(false);
  const [del, setDel] = React.useState<ExpenseClaim | null>(null);
  const claims = useClaims('mine');
  const travel = useTravel('mine');
  const submit = useSubmitClaim();
  const remove = useDeleteClaim();
  return (
    <>
      <PageHeader title="Expenses & travel" description="Claim reimbursements and request business travel." actions={<><Button variant="outline" onClick={() => setTravelOpen(true)}><Plane className="mr-2 h-4 w-4" />Travel request</Button><Button onClick={() => setClaimOpen(true)}><Plus className="mr-2 h-4 w-4" />New claim</Button></>} />
      <Tabs defaultValue="claims">
        <TabsList><TabsTrigger value="claims">Expense claims</TabsTrigger><TabsTrigger value="travel">Travel requests</TabsTrigger></TabsList>
        <TabsContent value="claims" className="mt-4">
          <DataTable rows={claims.data} loading={claims.isLoading} error={claims.error} rowKey={(r) => r.id} emptyTitle="No expense claims" emptyDescription="Create a claim with your receipts to get reimbursed."
            emptyAction={<Button onClick={() => setClaimOpen(true)}><Receipt className="mr-2 h-4 w-4" />New claim</Button>}
            columns={[
              { key: 't', header: 'Title', cell: (r) => <div><p className="font-semibold">{r.title}</p><p className="text-fine text-muted-foreground">{r.items.length} item(s)</p></div> },
              { key: 'a', header: 'Claimed', cell: (r) => formatINR(r.totalClaimed), align: 'right' },
              { key: 'p', header: 'Approved', cell: (r) => (r.status === 'APPROVED' || r.status === 'REIMBURSED' ? formatINR(r.totalApproved) : '-'), align: 'right' },
              { key: 'd', header: 'Created', cell: (r) => formatDate(r.createdAt), hideOnMobile: true },
              { key: 's', header: 'Status', cell: (r) => <div><StatusBadge status={r.status} />{r.approverComment && <p className="mt-1 text-fine text-muted-foreground">{r.approverComment}</p>}</div> },
              { key: 'x', header: '', align: 'right', cell: (r) => r.status === 'DRAFT' || r.status === 'REJECTED' ? <div className="flex justify-end gap-1"><Button size="sm" onClick={() => submit.mutate(r.id)} disabled={submit.isPending}>Submit</Button>{r.status === 'DRAFT' && <Button size="sm" variant="ghost" onClick={() => setDel(r)}>Delete</Button>}</div> : null },
            ]} />
        </TabsContent>
        <TabsContent value="travel" className="mt-4">
          <DataTable rows={travel.data} loading={travel.isLoading} error={travel.error} rowKey={(r) => r.id} emptyTitle="No travel requests" columns={[
            { key: 'p', header: 'Purpose', cell: (r) => <span className="font-semibold">{r.purpose}</span> },
            { key: 'r', header: 'Route', cell: (r) => `${r.fromLocation} → ${r.toLocation}`, hideOnMobile: true },
            { key: 'd', header: 'Dates', cell: (r) => `${formatDate(r.departureDate, false)} - ${formatDate(r.returnDate, false)}` },
            { key: 'c', header: 'Est. cost', cell: (r) => (r.estimatedCost ? formatINR(r.estimatedCost) : '-'), align: 'right' },
            { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]} />
        </TabsContent>
      </Tabs>
      <ExpenseClaimModal open={claimOpen} onOpenChange={setClaimOpen} />
      <TravelModal open={travelOpen} onOpenChange={setTravelOpen} />
      <ConfirmModal open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete draft claim?" description={del?.title ?? ''} confirmLabel="Delete" destructive loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => setDel(null) })} />
    </>
  );
}

function TravelModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateTravel();
  const [f, setF] = React.useState({ purpose: '', fromLocation: '', toLocation: '', departureDate: todayISO(), returnDate: todayISO(), estimatedCost: '', advanceRequired: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Travel request" description="Your manager approves the trip before you book.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ purpose: f.purpose, fromLocation: f.fromLocation, toLocation: f.toLocation, departureDate: f.departureDate, returnDate: f.returnDate, estimatedCost: f.estimatedCost ? Number(f.estimatedCost) : undefined, advanceRequired: f.advanceRequired ? Number(f.advanceRequired) : undefined }, { onSuccess: () => onOpenChange(false) }); }}>
        <Field label="Purpose" htmlFor="tp" required><Input id="tp" required value={f.purpose} onChange={set('purpose')} /></Field>
        <FormGrid><Field label="From" htmlFor="tf" required><Input id="tf" required value={f.fromLocation} onChange={set('fromLocation')} /></Field><Field label="To" htmlFor="tt" required><Input id="tt" required value={f.toLocation} onChange={set('toLocation')} /></Field>
          <Field label="Departure" htmlFor="td" required><Input id="td" type="date" required value={f.departureDate} onChange={set('departureDate')} /></Field><Field label="Return" htmlFor="tr" required><Input id="tr" type="date" required min={f.departureDate} value={f.returnDate} onChange={set('returnDate')} /></Field>
          <Field label="Estimated cost (₹)" htmlFor="te"><Input id="te" type="number" min="0" value={f.estimatedCost} onChange={set('estimatedCost')} /></Field><Field label="Advance needed (₹)" htmlFor="ta"><Input id="ta" type="number" min="0" value={f.advanceRequired} onChange={set('advanceRequired')} /></Field></FormGrid>
        <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Submit</Button></div>
      </form>
    </Modal>
  );
}
