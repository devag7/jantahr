'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NativeSelect } from '@/components/ui/native-select';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { ConfirmModal, Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { ApplyLeaveForm } from '@/components/leave/apply-leave-form';
import { LeaveBalanceCards } from '@/components/leave/leave-balance-cards';
import { LeaveCalendar } from '@/components/leave/leave-calendar';
import { useCancelLeave, useCompOff, useEncashments, useLeaveBalance, useLeaveList, useRequestCompOff, useRequestEncashment } from '@/hooks/leave/use-leave';
import { formatDate, formatINR, todayISO } from '@/lib/format';
import type { LeaveApplication } from '@/types/leave';

export default function MyLeavePage() {
  const [apply, setApply] = React.useState(false);
  const [cancel, setCancel] = React.useState<LeaveApplication | null>(null);
  const balance = useLeaveBalance();
  const list = useLeaveList({ scope: 'mine', limit: 50 });
  const cancelMut = useCancelLeave();
  return (
    <>
      <PageHeader title="Leave" description="Balances, applications, encashment and comp-off." actions={<Button onClick={() => setApply(true)}><Plus className="mr-2 h-4 w-4" />Apply for leave</Button>} />
      <QueryBoundary query={balance}>{(b) => <LeaveBalanceCards balances={b} />}</QueryBoundary>
      <Tabs defaultValue="applications" className="mt-6">
        <TabsList><TabsTrigger value="applications">My applications</TabsTrigger><TabsTrigger value="calendar">Calendar</TabsTrigger><TabsTrigger value="encash">Encashment</TabsTrigger><TabsTrigger value="comp">Comp-off</TabsTrigger></TabsList>
        <TabsContent value="applications" className="mt-4">
          <DataTable rows={list.data?.items} loading={list.isLoading} error={list.error} rowKey={(r) => r.id} emptyTitle="No leave applications yet" emptyDescription="Applications you submit will appear here with their approval status."
            columns={[
              { key: 't', header: 'Type', cell: (r) => <span className="font-semibold">{r.leaveType.name}</span> },
              { key: 'd', header: 'Dates', cell: (r) => `${formatDate(r.fromDate, false)}${r.fromDate !== r.toDate ? ` → ${formatDate(r.toDate, false)}` : ''}${r.halfDay ? ' (half day)' : ''}` },
              { key: 'n', header: 'Days', cell: (r) => r.totalLeaveDays, align: 'right' },
              { key: 'r', header: 'Reason', cell: (r) => <span className="line-clamp-1 text-muted-foreground">{r.reason ?? '-'}</span>, hideOnMobile: true },
              { key: 's', header: 'Status', cell: (r) => <div><StatusBadge status={r.status} />{r.approverComment && <p className="mt-1 text-fine text-muted-foreground">{r.approverComment}</p>}</div> },
              { key: 'a', header: '', align: 'right', cell: (r) => (r.status === 'OPEN' || (r.status === 'APPROVED' && new Date(r.fromDate) > new Date())) ? <Button size="sm" variant="ghost" onClick={() => setCancel(r)}>Cancel</Button> : null },
            ]} />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4"><LeaveCalendar /></TabsContent>
        <TabsContent value="encash" className="mt-4"><EncashmentTab /></TabsContent>
        <TabsContent value="comp" className="mt-4"><CompOffTab /></TabsContent>
      </Tabs>
      <Modal open={apply} onOpenChange={setApply} title="Apply for leave" description="The day count below comes from your holiday calendar and leave rules."><ApplyLeaveForm onDone={() => setApply(false)} /></Modal>
      <ConfirmModal open={!!cancel} onOpenChange={(o) => !o && setCancel(null)} title="Cancel this leave?" description={cancel ? `${cancel.leaveType.name} · ${formatDate(cancel.fromDate)}${cancel.status === 'APPROVED' ? ': your balance will be restored.' : ''}` : ''} confirmLabel="Cancel leave" destructive loading={cancelMut.isPending}
        onConfirm={() => cancel && cancelMut.mutate(cancel.id, { onSuccess: () => setCancel(null) })} />
    </>
  );
}

function EncashmentTab() {
  const balance = useLeaveBalance();
  const list = useEncashments();
  const request = useRequestEncashment();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ leaveTypeId: '', days: '1' });
  const encashable = balance.data?.filter((b) => b.isEncashable && b.available > 0) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" disabled={!encashable.length} onClick={() => { setF({ leaveTypeId: encashable[0]?.leaveTypeId ?? '', days: '1' }); setOpen(true); }}>Request encashment</Button></div>
      <DataTable rows={list.data} loading={list.isLoading} error={list.error} rowKey={(r) => r.id} emptyTitle="No encashment requests" emptyDescription={encashable.length ? undefined : 'You have no encashable leave balance right now.'}
        columns={[{ key: 't', header: 'Leave type', cell: (r) => r.leaveType.name }, { key: 'd', header: 'Days', cell: (r) => r.encashableDays, align: 'right' }, { key: 'a', header: 'Amount', cell: (r) => formatINR(r.encashmentAmount), align: 'right' }, { key: 'dt', header: 'Requested', cell: (r) => formatDate(r.createdAt) }, { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> }]} />
      <Modal open={open} onOpenChange={setOpen} title="Encash leave" description="Paid with your next salary: (Basic + DA ÷ 30) × days. It may be taxable.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); request.mutate({ leaveTypeId: f.leaveTypeId, days: Number(f.days) }, { onSuccess: () => setOpen(false) }); }}>
          <Field label="Leave type"><NativeSelect value={f.leaveTypeId} onChange={(e) => setF({ ...f, leaveTypeId: e.target.value })}>{encashable.map((b) => <option key={b.leaveTypeId} value={b.leaveTypeId}>{b.leaveType} ({b.available} available)</option>)}</NativeSelect></Field>
          <Field label="Days" htmlFor="ed"><Input id="ed" type="number" step="0.5" min="0.5" required value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
          <div className="flex justify-end"><Button type="submit" disabled={request.isPending}>Submit</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function CompOffTab() {
  const list = useCompOff();
  const request = useRequestCompOff();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ workFromDate: todayISO(), reason: '' });
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Worked on a holiday or weekly off?</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><p className="text-caption text-muted-foreground">Claim a compensatory off. It stays valid for 90 days from the day you worked.</p><Button onClick={() => setOpen(true)}>Claim comp-off</Button></CardContent></Card>
      <DataTable rows={list.data} loading={list.isLoading} error={list.error} rowKey={(r) => r.id} emptyTitle="No comp-off requests"
        columns={[{ key: 'd', header: 'Worked on', cell: (r) => formatDate(r.workFromDate) }, { key: 'h', header: 'Half day', cell: (r) => (r.halfDay ? 'Yes' : 'No') }, { key: 'r', header: 'Reason', cell: (r) => r.reason }, { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> }]} />
      <Modal open={open} onOpenChange={setOpen} title="Claim compensatory off">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); request.mutate({ workFromDate: f.workFromDate, reason: f.reason }, { onSuccess: () => setOpen(false) }); }}>
          <FormGrid cols={1}><Field label="Date you worked" htmlFor="cw" required><Input id="cw" type="date" required max={todayISO()} value={f.workFromDate} onChange={(e) => setF({ ...f, workFromDate: e.target.value })} /></Field>
            <Field label="Reason" htmlFor="cr" required><Textarea id="cr" required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Production release on Saturday" /></Field></FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={request.isPending}>Submit</Button></div>
        </form>
      </Modal>
    </div>
  );
}
