'use client';
import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DecisionButtons } from '@/components/approvals/decision-buttons';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { LeaveCalendar } from '@/components/leave/leave-calendar';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEmployees } from '@/hooks/employees/use-employees';
import { useApproveLeave, useAssignPolicy, useCompOff, useCreateLeaveType, useDecideCompOff, useDecideEncashment, useDeleteLeaveType, useEncashments, useLeaveAllocations, useLeaveList, useLeavePolicies, useLeaveTypes, useManualAllocate, useRejectLeave, useRunAccrual, useSavePolicy, useUpdateLeaveType } from '@/hooks/leave/use-leave';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { formatDate, formatINR, todayISO } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import type { LeavePolicy, LeaveType } from '@/types/leave';

export default function HrLeavePage() {
  const { hasRole } = useAuth();
  const admin = hasRole(ADMIN);
  return (
    <>
      <PageHeader title="Leave management" description="Applications, leave types, policies, balances, encashment and comp-off." />
      <Tabs defaultValue="applications">
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="applications">Applications</TabsTrigger><TabsTrigger value="calendar">Company calendar</TabsTrigger><TabsTrigger value="types">Leave types</TabsTrigger><TabsTrigger value="policies">Policies</TabsTrigger><TabsTrigger value="allocations">Balances & accrual</TabsTrigger><TabsTrigger value="other">Encashment & comp-off</TabsTrigger></TabsList>
        <TabsContent value="applications" className="mt-4"><ApplicationsTab admin={admin} /></TabsContent>
        <TabsContent value="calendar" className="mt-4"><LeaveCalendar /></TabsContent>
        <TabsContent value="types" className="mt-4"><TypesTab admin={admin} /></TabsContent>
        <TabsContent value="policies" className="mt-4"><PoliciesTab admin={admin} /></TabsContent>
        <TabsContent value="allocations" className="mt-4"><AllocationsTab admin={admin} /></TabsContent>
        <TabsContent value="other" className="mt-4"><EncashCompTab admin={admin} /></TabsContent>
      </Tabs>
    </>
  );
}

function ApplicationsTab({ admin }: { admin: boolean }) {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const q = useLeaveList({ scope: 'all', status: status || undefined, page, limit: DEFAULT_PAGE_SIZE });
  const approve = useApproveLeave();
  const reject = useRejectLeave();
  React.useEffect(() => setPage(1), [status]);
  return (
    <div className="space-y-4">
      <NativeSelect aria-label="Status" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['OPEN', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</NativeSelect>
      <DataTable rows={q.data?.items} loading={q.isLoading} error={q.error} rowKey={(l) => l.id} emptyTitle="No leave applications" page={q.data && { page: q.data.page, totalPages: q.data.totalPages, total: q.data.total, onChange: setPage }} columns={[
        { key: 'e', header: 'Employee', cell: (l) => <div><p className="font-semibold">{l.employee.firstName} {l.employee.lastName}</p><p className="text-fine text-muted-foreground">{l.employee.employeeCode} · {l.employee.department?.name ?? '-'}</p></div> },
        { key: 't', header: 'Leave', cell: (l) => l.leaveType.name }, { key: 'd', header: 'Dates', cell: (l) => `${formatDate(l.fromDate, false)}${l.fromDate !== l.toDate ? ` → ${formatDate(l.toDate, false)}` : ''}` }, { key: 'n', header: 'Days', cell: (l) => l.totalLeaveDays, align: 'right' },
        { key: 's', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> },
        { key: 'a', header: '', cell: (l) => (admin && l.status === 'OPEN' ? <DecisionButtons subject={`${l.employee.firstName}: ${l.leaveType.name}`} busy={approve.isPending || reject.isPending} onApprove={(c) => approve.mutate({ id: l.id, comment: c })} onReject={(c) => reject.mutate({ id: l.id, comment: c })} /> : null) },
      ]} />
    </div>
  );
}

const TYPE_FLAGS: { key: keyof LeaveType; label: string }[] = [
  { key: 'isCarryForward', label: 'Carry forward' }, { key: 'isEncashable', label: 'Encashable' }, { key: 'isEarnedLeave', label: 'Accrues monthly (earned leave)' }, { key: 'sandwichRule', label: 'Sandwich rule' },
  { key: 'includeHolidays', label: 'Count holidays as leave' }, { key: 'isLWP', label: 'Leave without pay' }, { key: 'isCompensatory', label: 'Compensatory off' }, { key: 'allowNegativeBalance', label: 'Allow negative balance' },
];

function TypesTab({ admin }: { admin: boolean }) {
  const q = useLeaveTypes();
  const del = useDeleteLeaveType();
  const create = useCreateLeaveType();
  const update = useUpdateLeaveType();
  const [edit, setEdit] = React.useState<Partial<LeaveType> | null>(null);
  const save = () => { if (!edit) return; const { id, ...data } = edit; (id ? update.mutate({ id, data }, { onSuccess: () => setEdit(null) }) : create.mutate(data, { onSuccess: () => setEdit(null) })); };
  return (
    <div className="space-y-4">
      {admin && <div className="flex justify-end"><Button onClick={() => setEdit({ name: '', isPaid: true })}><Plus className="mr-1 h-4 w-4" />New leave type</Button></div>}
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(t) => t.id} columns={[
        { key: 'n', header: 'Leave type', cell: (t) => <span className="font-semibold">{t.name}</span> },
        { key: 'f', header: 'Rules', cell: (t) => <div className="flex flex-wrap gap-1">{TYPE_FLAGS.filter((f) => t[f.key]).map((f) => <Badge key={f.key} variant="muted">{f.label}</Badge>)}{t.maxCarryForwardDays ? <Badge variant="muted">Carry ≤ {t.maxCarryForwardDays}</Badge> : null}{t.applicableGender && <Badge variant="info">{t.applicableGender.toLowerCase()} only</Badge>}</div> },
        { key: 'p', header: 'Paid', cell: (t) => (t.isPaid ? 'Yes' : 'No'), hideOnMobile: true },
        { key: 'a', header: '', align: 'right', cell: (t) => admin && <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit(t)}>Edit</Button><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button></div> },
      ]} />
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="lg" title={edit?.id ? 'Edit leave type' : 'New leave type'}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.name || create.isPending || update.isPending} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <FormGrid><Field label="Name" htmlFor="ltn" required><Input id="ltn" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Applicable to"><NativeSelect value={edit.applicableGender ?? ''} onChange={(e) => setEdit({ ...edit, applicableGender: (e.target.value || null) as LeaveType['applicableGender'] })}><option value="">Everyone</option><option value="FEMALE">Female only</option><option value="MALE">Male only</option></NativeSelect></Field>
              <Field label="Max carry-forward days" htmlFor="ltc"><Input id="ltc" type="number" min="0" value={edit.maxCarryForwardDays ?? ''} onChange={(e) => setEdit({ ...edit, maxCarryForwardDays: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Max encashable days" htmlFor="lte"><Input id="lte" type="number" min="0" value={edit.maxEncashableDays ?? ''} onChange={(e) => setEdit({ ...edit, maxEncashableDays: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Max continuous days" htmlFor="ltm"><Input id="ltm" type="number" min="1" value={edit.maxContinuousDays ?? ''} onChange={(e) => setEdit({ ...edit, maxContinuousDays: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Max balance / year" htmlFor="ltx"><Input id="ltx" type="number" min="0" value={edit.maxDaysAllowed ?? ''} onChange={(e) => setEdit({ ...edit, maxDaysAllowed: e.target.value ? Number(e.target.value) : null })} /></Field></FormGrid>
            <div className="grid gap-2 sm:grid-cols-2">{[...TYPE_FLAGS, { key: 'isPaid' as const, label: 'Paid leave' }].map((f) => <label key={f.key} className="flex items-center gap-2 text-caption"><Checkbox checked={!!edit[f.key]} onCheckedChange={(c) => setEdit({ ...edit, [f.key]: c })} />{f.label}</label>)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PoliciesTab({ admin }: { admin: boolean }) {
  const policies = useLeavePolicies();
  const types = useLeaveTypes();
  const save = useSavePolicy();
  const assign = useAssignPolicy();
  const [edit, setEdit] = React.useState<{ id?: string; name: string; alloc: Record<string, string> } | null>(null);
  const [assignFor, setAssignFor] = React.useState<LeavePolicy | null>(null);
  const openEdit = (p?: LeavePolicy) => setEdit({ id: p?.id, name: p?.name ?? '', alloc: Object.fromEntries((p?.details ?? []).map((d) => [d.leaveTypeId, String(d.annualAllocation)])) });
  return (
    <div className="space-y-4">
      {admin && <div className="flex justify-end"><Button onClick={() => openEdit()}><Plus className="mr-1 h-4 w-4" />New policy</Button></div>}
      <DataTable rows={policies.data} loading={policies.isLoading} error={policies.error} rowKey={(p) => p.id} columns={[
        { key: 'n', header: 'Policy', cell: (p) => <span className="font-semibold">{p.name}</span> },
        { key: 'd', header: 'Annual allocation', cell: (p) => <div className="flex flex-wrap gap-1">{p.details.map((d) => <Badge key={d.leaveTypeId} variant="muted">{d.leaveType?.name}: {d.annualAllocation}</Badge>)}</div> },
        { key: 'a', header: 'Assigned', cell: (p) => p._count.assignments, align: 'right' },
        { key: 'x', header: '', align: 'right', cell: (p) => admin && <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button><Button size="sm" variant="outline" onClick={() => setAssignFor(p)}>Assign</Button></div> },
      ]} />
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="lg" title={edit?.id ? 'Edit policy' : 'New leave policy'} description="Days credited per year. Earned leave accrues monthly; others are credited up-front (pro-rated for mid-year joiners)."
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.name || save.isPending} onClick={() => edit && save.mutate({ id: edit.id, name: edit.name, details: Object.entries(edit.alloc).filter(([, v]) => Number(v) > 0).map(([leaveTypeId, v]) => ({ leaveTypeId, annualAllocation: Number(v) })) }, { onSuccess: () => setEdit(null) })}>Save</Button></>}>
        {edit && <div className="space-y-4"><Field label="Policy name" htmlFor="pn" required><Input id="pn" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <FormGrid>{types.data?.filter((t) => !t.isLWP && !t.isCompensatory).map((t) => <Field key={t.id} label={t.name} htmlFor={t.id}><Input id={t.id} type="number" min="0" step="0.5" value={edit.alloc[t.id] ?? ''} onChange={(e) => setEdit({ ...edit, alloc: { ...edit.alloc, [t.id]: e.target.value } })} placeholder="0" /></Field>)}</FormGrid></div>}
      </Modal>
      <Modal open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)} size="sm" title="Assign policy" description={`Apply “${assignFor?.name}” to all active employees. Their balances are (re)allocated for the current year.`}
        footer={<><Button variant="outline" onClick={() => setAssignFor(null)}>Cancel</Button><Button disabled={assign.isPending} onClick={() => assignFor && assign.mutate({ id: assignFor.id, allEmployees: true }, { onSuccess: () => setAssignFor(null) })}>Assign to everyone</Button></>}><span /></Modal>
    </div>
  );
}

function AllocationsTab({ admin }: { admin: boolean }) {
  const q = useLeaveAllocations();
  const accrual = useRunAccrual();
  const manual = useManualAllocate();
  const emps = useEmployees({ limit: 200, status: 'ACTIVE' });
  const types = useLeaveTypes();
  const [open, setOpen] = React.useState(false);
  const y = new Date().getFullYear();
  const [f, setF] = React.useState({ employeeId: '', leaveTypeId: '', days: '1', fromDate: `${y}-01-01`, toDate: `${y}-12-31`, reason: '' });
  return (
    <div className="space-y-4">
      {admin && <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={accrual.isPending} onClick={() => accrual.mutate()}>Run this month’s earned-leave accrual</Button><Button onClick={() => setOpen(true)}>Credit leave manually</Button></div>}
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(a) => a.id} dense columns={[
        { key: 'e', header: 'Employee', cell: (a) => `${a.employee.firstName} ${a.employee.lastName} (${a.employee.employeeCode})` }, { key: 't', header: 'Leave type', cell: (a) => a.leaveType.name }, { key: 'p', header: 'Period', cell: (a) => `${formatDate(a.fromDate, false)} - ${formatDate(a.toDate, false)}`, hideOnMobile: true },
        { key: 'a', header: 'Allocated', cell: (a) => a.totalLeavesAllocated, align: 'right' }, { key: 'u', header: 'Used', cell: (a) => a.usedLeaves, align: 'right' }, { key: 'b', header: 'Balance', cell: (a) => <b>{Math.round((a.totalLeavesAllocated - a.usedLeaves) * 100) / 100}</b>, align: 'right' },
      ]} />
      <Modal open={open} onOpenChange={setOpen} title="Credit leave" description="Adds a one-off allocation (e.g. special leave or correction).">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); manual.mutate({ employeeId: f.employeeId, leaveTypeId: f.leaveTypeId, days: Number(f.days), fromDate: f.fromDate, toDate: f.toDate, reason: f.reason || undefined }, { onSuccess: () => setOpen(false) }); }}>
          <Field label="Employee"><NativeSelect required value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{emps.data?.items.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}</NativeSelect></Field>
          <Field label="Leave type"><NativeSelect required value={f.leaveTypeId} onChange={(e) => setF({ ...f, leaveTypeId: e.target.value })}><option value="">Select…</option>{types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect></Field>
          <FormGrid cols={3}><Field label="Days"><Input type="number" min="0.5" step="0.5" required value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field><Field label="Valid from"><Input type="date" required value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} /></Field><Field label="Valid to"><Input type="date" required value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></Field></FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={manual.isPending}>Credit</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function EncashCompTab({ admin }: { admin: boolean }) {
  const enc = useEncashments();
  const comp = useCompOff();
  const decideEnc = useDecideEncashment();
  const decideComp = useDecideCompOff();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Leave encashment</CardTitle></CardHeader><CardContent><DataTable bare rows={enc.data} loading={enc.isLoading} error={enc.error} rowKey={(e) => e.id} emptyTitle="No requests" columns={[
        { key: 'e', header: 'Employee', cell: (e) => `${e.employee.firstName} ${e.employee.lastName}` }, { key: 'd', header: 'Days', cell: (e) => e.encashableDays, align: 'right' }, { key: 'a', header: 'Amount', cell: (e) => formatINR(e.encashmentAmount), align: 'right' }, { key: 's', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
        { key: 'x', header: '', cell: (e) => (admin && e.status === 'PENDING' ? <DecisionButtons subject={`${e.encashableDays} day(s): ${formatINR(e.encashmentAmount)}`} busy={decideEnc.isPending} onApprove={() => decideEnc.mutate({ id: e.id, action: 'approve' })} onReject={() => decideEnc.mutate({ id: e.id, action: 'reject' })} /> : null) },
      ]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Compensatory off</CardTitle></CardHeader><CardContent><DataTable bare rows={comp.data} loading={comp.isLoading} error={comp.error} rowKey={(c) => c.id} emptyTitle="No requests" columns={[
        { key: 'e', header: 'Employee', cell: (c) => `${c.employee.firstName} ${c.employee.lastName}` }, { key: 'd', header: 'Worked', cell: (c) => formatDate(c.workFromDate, false) }, { key: 's', header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
        { key: 'x', header: '', cell: (c) => (admin && c.status === 'PENDING' ? <DecisionButtons subject={`Comp-off ${formatDate(c.workFromDate)}`} busy={decideComp.isPending} onApprove={() => decideComp.mutate({ id: c.id, action: 'approve' })} onReject={() => decideComp.mutate({ id: c.id, action: 'reject' })} /> : null) },
      ]} /></CardContent></Card>
    </div>
  );
}
