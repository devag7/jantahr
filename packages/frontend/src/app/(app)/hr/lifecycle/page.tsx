'use client';
import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/common/data-table';
import { DetailList } from '@/components/common/detail-list';
import { DownloadButton } from '@/components/common/download-button';
import { Field, FormGrid } from '@/components/common/field';
import { ConfirmModal, Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEmployees } from '@/hooks/employees/use-employees';
import { useApproveFnf, useClearance, useCompleteSeparation, useComputeFnf, useDecideSeparation, useExitInterview, useInitiateSeparation, useOnboardings, useSeparations, useUpdateTask } from '@/hooks/lifecycle/use-lifecycle';
import { formatDate, formatINR, todayISO } from '@/lib/format';
import { ADMIN, PAYROLL } from '@/lib/permissions';
import { lifecycleService } from '@/services/lifecycle/lifecycle.service';
import type { SeparationType } from '@/types/lifecycle';

export default function LifecyclePage() {
  return (
    <>
      <PageHeader title="Onboarding & exits" description="New-joiner checklists and the full separation workflow through full & final settlement." />
      <Tabs defaultValue="onboarding">
        <TabsList><TabsTrigger value="onboarding">Onboarding</TabsTrigger><TabsTrigger value="exits">Exits & F&F</TabsTrigger></TabsList>
        <TabsContent value="onboarding" className="mt-4"><OnboardingTab /></TabsContent>
        <TabsContent value="exits" className="mt-4"><ExitsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function OnboardingTab() {
  const [all, setAll] = React.useState(false);
  const q = useOnboardings(all);
  const update = useUpdateTask();
  const { hasRole } = useAuth();
  const canEdit = hasRole(ADMIN);
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-caption"><input type="checkbox" className="accent-primary" checked={all} onChange={(e) => setAll(e.target.checked)} />Include completed</label>
      <QueryBoundary query={q} empty={{ when: (d) => d.length === 0, title: 'No open onboardings', description: 'New employees get a checklist automatically when added.' }}>
        {(list) => (
          <div className="grid gap-4 xl:grid-cols-2">
            {list.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3"><div><Link href={`/hr/employees/${o.employeeId}`} className="font-semibold hover:underline">{o.employee.firstName} {o.employee.lastName}</Link><p className="text-fine text-muted-foreground">{o.employee.employeeCode} · joined {formatDate(o.employee.dateOfJoining)}</p></div><div className="w-32 text-right"><Progress value={o.progress.percent} tone="success" /><p className="mt-1 text-fine text-muted-foreground">{o.progress.done}/{o.progress.total} done</p></div></div>
                <ul className="divide-y text-caption">{o.tasks.map((t) => {
                  const overdue = t.dueDate && t.status !== 'COMPLETED' && t.status !== 'SKIPPED' && new Date(t.dueDate) < new Date();
                  return <li key={t.id} className="flex items-center gap-3 py-2"><input type="checkbox" disabled={!canEdit} className="h-4 w-4 accent-primary" checked={t.status === 'COMPLETED'} onChange={(e) => update.mutate({ id: t.id, status: e.target.checked ? 'COMPLETED' : 'PENDING' })} aria-label={t.title} /><span className={`min-w-0 flex-1 ${t.status === 'COMPLETED' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</span><Badge variant="muted">{t.assignedTo ?? '-'}</Badge>{overdue && <Badge variant="destructive">Overdue</Badge>}</li>;
                })}</ul>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

function ExitsTab() {
  const q = useSeparations();
  const { hasRole } = useAuth();
  const [openId, setOpenId] = React.useState<string | undefined>();
  const [init, setInit] = React.useState(false);
  return (
    <div className="space-y-4">
      {hasRole(ADMIN) && <div className="flex justify-end"><Button variant="outline" onClick={() => setInit(true)}><Plus className="mr-1 h-4 w-4" />Initiate separation</Button></div>}
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(s) => s.id} onRowClick={(s) => setOpenId(s.id)} emptyTitle="No separations" emptyDescription="Resignations and terminations appear here." columns={[
        { key: 'e', header: 'Employee', cell: (s) => <div><p className="font-semibold">{s.employee.firstName} {s.employee.lastName}</p><p className="text-fine text-muted-foreground">{s.employee.employeeCode} · {s.employee.department?.name ?? '-'}</p></div> },
        { key: 't', header: 'Type', cell: (s) => <span className="capitalize">{s.separationType.toLowerCase()}</span> }, { key: 'l', header: 'Last working day', cell: (s) => formatDate(s.lastWorkingDate) },
        { key: 'c', header: 'Clearance', cell: (s) => (s.clearances.length ? `${s.clearances.filter((c) => c.status !== 'PENDING').length}/${s.clearances.length}` : '-'), hideOnMobile: true },
        { key: 'f', header: 'F&F', cell: (s) => (s.fnfSettlement ? <StatusBadge status={s.fnfSettlement.status} /> : <span className="text-muted-foreground">-</span>) }, { key: 's', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
      ]} />
      <SeparationModal id={openId} onClose={() => setOpenId(undefined)} />
      <InitiateModal open={init} onOpenChange={setInit} />
    </div>
  );
}

function InitiateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const emps = useEmployees({ limit: 200, status: 'ACTIVE' });
  const init = useInitiateSeparation();
  const [f, setF] = React.useState({ employeeId: '', separationType: 'TERMINATION' as SeparationType, lastWorkingDate: todayISO(), reason: '' });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Initiate separation" description="For terminations, retirement, mutual separation or absconding. Resignations are raised by employees.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); init.mutate({ ...f, reason: f.reason || undefined }, { onSuccess: () => onOpenChange(false) }); }}>
        <Field label="Employee"><NativeSelect required value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{emps.data?.items.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}</NativeSelect></Field>
        <FormGrid><Field label="Type"><NativeSelect value={f.separationType} onChange={(e) => setF({ ...f, separationType: e.target.value as SeparationType })}>{['TERMINATION', 'RETIREMENT', 'MUTUAL', 'ABSCONDING'].map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}</NativeSelect></Field><Field label="Last working day" htmlFor="lw"><Input id="lw" type="date" required value={f.lastWorkingDate} onChange={(e) => setF({ ...f, lastWorkingDate: e.target.value })} /></Field></FormGrid>
        <Field label="Reason" htmlFor="rr"><Textarea id="rr" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <div className="flex justify-end"><Button type="submit" variant="destructive" disabled={init.isPending || !f.employeeId}>Initiate</Button></div>
      </form>
    </Modal>
  );
}

function SeparationModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const q = useSeparations();
  const s = q.data?.find((x) => x.id === id);
  const { hasRole } = useAuth();
  const admin = hasRole(ADMIN);
  const payroll = hasRole(PAYROLL);
  const decide = useDecideSeparation();
  const clear = useClearance();
  const interview = useExitInterview();
  const fnf = useComputeFnf();
  const approveFnf = useApproveFnf();
  const complete = useCompleteSeparation();
  const [notes, setNotes] = React.useState('');
  const [bonus, setBonus] = React.useState('');
  const [other, setOther] = React.useState('');
  const [confirmComplete, setConfirmComplete] = React.useState(false);
  const f = s?.fnfSettlement;
  return (
    <Modal open={!!id} onOpenChange={(o) => !o && onClose()} size="xl" title={s ? `${s.employee.firstName} ${s.employee.lastName}: ${s.separationType.toLowerCase()}` : 'Separation'} description={s ? `${s.employee.employeeCode} · joined ${formatDate(s.employee.dateOfJoining)} · last working day ${formatDate(s.lastWorkingDate)}` : undefined}>
      {s && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={s.status} label={s.status === 'PENDING' ? 'Awaiting approval' : 'Accepted'} />{s.exitInterviewDone && <Badge variant="success">Exit interview done</Badge>}{s.relievingLetterIssued && <Badge variant="muted">Relieving letter issued</Badge>}</div>
          {s.exitInterviewNotes && <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-caption">{s.exitInterviewNotes}</p>}

          {s.status === 'PENDING' && (
            <div className="flex gap-2"><Button disabled={decide.isPending} onClick={() => decide.mutate({ id: s.id, action: 'approve' })}>Accept resignation</Button><Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: s.id, action: 'reject' }, { onSuccess: onClose })}>Decline</Button></div>
          )}

          {s.status === 'APPROVED' && (
            <>
              <section><h3 className="mb-2 text-caption font-semibold">Exit clearance</h3>
                <ul className="divide-y rounded-md border">{s.clearances.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-caption"><span>{c.department}</span>
                    {admin ? <NativeSelect aria-label={`${c.department} clearance`} className="h-8 w-40 py-0 text-fine" value={c.status} onChange={(e) => clear.mutate({ id: c.id, status: e.target.value as 'PENDING' | 'CLEARED' | 'NOT_APPLICABLE' })}><option value="PENDING">Pending</option><option value="CLEARED">Cleared</option><option value="NOT_APPLICABLE">N/A</option></NativeSelect> : <StatusBadge status={c.status} />}</li>
                ))}</ul></section>

              {admin && !s.exitInterviewDone && (
                <section><h3 className="mb-2 text-caption font-semibold">Exit interview</h3><div className="flex gap-2"><Input aria-label="Exit interview notes" placeholder="Key feedback from the exit interview" value={notes} onChange={(e) => setNotes(e.target.value)} /><Button variant="outline" disabled={!notes.trim() || interview.isPending} onClick={() => interview.mutate({ id: s.id, notes }, { onSuccess: () => setNotes('') })}>Record</Button></div></section>
              )}

              <section><h3 className="mb-2 text-caption font-semibold">Full & final settlement</h3>
                {payroll && f?.status !== 'APPROVED' && (
                  <div className="mb-3 flex flex-wrap items-end gap-2"><Field label="Bonus (₹)"><Input type="number" min="0" className="w-32" value={bonus} onChange={(e) => setBonus(e.target.value)} /></Field><Field label="Other deductions (₹)"><Input type="number" min="0" className="w-36" value={other} onChange={(e) => setOther(e.target.value)} /></Field><Button variant="outline" disabled={fnf.isPending} onClick={() => fnf.mutate({ id: s.id, bonusAmount: bonus ? Number(bonus) : undefined, otherDeductions: other ? Number(other) : undefined })}>{fnf.isPending && <Spinner className="mr-2" />}{f ? 'Recompute' : 'Compute F&F'}</Button></div>
                )}
                {f ? (
                  <div className="rounded-md border">
                    <table className="w-full text-caption"><tbody className="divide-y">
                      {[['Final month salary', f.lastSalary, 1], ['Leave encashment', f.leaveEncashmentAmount, 1], ['Gratuity', f.gratuityAmount, 1], ['Bonus', f.bonusAmount, 1], ['Notice-period & other deductions', f.deductions, -1], ['Loan / advance recovery', f.recoveries, -1]].map(([l, v, sign]) => <tr key={String(l)}><td className="px-3 py-2">{l}</td><td className={`px-3 py-2 text-right tabular-nums ${sign === -1 && Number(v) > 0 ? 'text-destructive' : ''}`}>{sign === -1 && Number(v) > 0 ? '− ' : ''}{formatINR(Number(v))}</td></tr>)}
                      <tr className="bg-muted/50 font-semibold"><td className="px-3 py-2.5">Net payable</td><td className="px-3 py-2.5 text-right tabular-nums">{formatINR(f.netPayable)}</td></tr></tbody></table>
                    {f.breakdown && <DetailList cols={3} items={[{ label: 'Years of service', value: f.breakdown.yearsOfService }, { label: 'Encashable days', value: f.breakdown.encashDays }, { label: 'Wages / month (labour-code)', value: formatINR(f.breakdown.wagesMonthly) }]} />}
                    {f.notes && f.notes.length > 0 && <ul className="list-disc space-y-0.5 border-t px-8 py-2 text-fine text-muted-foreground">{f.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                  </div>
                ) : <p className="text-caption text-muted-foreground">Not computed yet.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {payroll && f && f.status !== 'APPROVED' && <Button disabled={approveFnf.isPending} onClick={() => approveFnf.mutate(s.id)}>Approve F&F</Button>}
                  {f?.status === 'APPROVED' && <StatusBadge status="APPROVED" label="F&F approved" />}
                </div>
              </section>

              {admin && f?.status === 'APPROVED' && (
                <section className="flex flex-wrap gap-2 border-t pt-4">
                  <DownloadButton variant="outline" onDownload={() => lifecycleService.downloadLetter(s.id, 'relieving')}>Relieving letter</DownloadButton>
                  <DownloadButton variant="outline" onDownload={() => lifecycleService.downloadLetter(s.id, 'experience')}>Experience letter</DownloadButton>
                  <Button variant="destructive" className="ml-auto" onClick={() => setConfirmComplete(true)}>Complete separation</Button>
                </section>
              )}
            </>
          )}
          <ConfirmModal open={confirmComplete} onOpenChange={setConfirmComplete} destructive title="Complete separation?" description="The employee is marked as Left and their login is deactivated immediately." confirmLabel="Complete" loading={complete.isPending} onConfirm={() => complete.mutate(s.id, { onSuccess: () => { setConfirmComplete(false); onClose(); } })} />
        </div>
      )}
    </Modal>
  );
}
