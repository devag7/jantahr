'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail, MapPin, Phone, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { DetailList } from '@/components/common/detail-list';
import { ConfirmModal, Modal } from '@/components/common/modal';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { UserAvatar } from '@/components/common/user-avatar';
import { CompensationTab } from '@/components/employees/compensation-tab';
import { EmployeeForm } from '@/components/employees/employee-form';
import { ApplyLeaveForm } from '@/components/leave/apply-leave-form';
import { LeaveBalanceCards } from '@/components/leave/leave-balance-cards';
import { SlipDetailModal } from '@/components/payroll/slip-detail';
import { DocumentsCard } from '@/components/profile/documents-card';
import { AttendanceCalendar } from '@/components/attendance/attendance-calendar';
import { useMonthLog } from '@/hooks/attendance/use-attendance';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEmployee, useResetEmployeePassword, useSetEmployeeStatus, useUpdateEmployee } from '@/hooks/employees/use-employees';
import { useLeaveBalance } from '@/hooks/leave/use-leave';
import { useMyOnboarding, useUpdateTask } from '@/hooks/lifecycle/use-lifecycle';
import { useEmployeeSlips } from '@/hooks/payroll/use-payroll';
import { formatDate, formatINR, monthLabel } from '@/lib/format';
import { ADMIN, PAYROLL } from '@/lib/permissions';
import type { Employee } from '@/types/employees';
import type { Slip } from '@/types/payroll';

function AttendanceTab({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const q = useMonthLog(now.getFullYear(), now.getMonth() + 1, employeeId);
  return <QueryBoundary query={q}>{(d) => <Card><CardHeader><CardTitle>{monthLabel(d.month, d.year)}: {d.summary.present + d.summary.wfh} present · {d.summary.absent} absent · {d.summary.lateMarks} late</CardTitle></CardHeader><CardContent><AttendanceCalendar days={d.days} /></CardContent></Card>}</QueryBoundary>;
}

function LeaveTab({ employeeId }: { employeeId: string }) {
  const q = useLeaveBalance(employeeId);
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" onClick={() => setOpen(true)}>Apply leave on behalf</Button></div>
      <QueryBoundary query={q}>{(b) => <LeaveBalanceCards balances={b} />}</QueryBoundary>
      <Modal open={open} onOpenChange={setOpen} title="Apply leave on behalf"><ApplyLeaveForm employeeId={employeeId} onDone={() => setOpen(false)} /></Modal>
    </div>
  );
}

function PayslipsTab({ employeeId }: { employeeId: string }) {
  const q = useEmployeeSlips(employeeId);
  const [open, setOpen] = React.useState<Slip | null>(null);
  return (
    <>
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(s) => s.id} onRowClick={setOpen} emptyTitle="No salary slips yet" columns={[
        { key: 'm', header: 'Month', cell: (s) => monthLabel(s.month, s.year) }, { key: 'g', header: 'Gross', cell: (s) => formatINR(s.grossPay), align: 'right' }, { key: 'd', header: 'Deductions', cell: (s) => formatINR(s.totalDeductions), align: 'right' },
        { key: 'n', header: 'Net pay', cell: (s) => <b className="tabular-nums">{formatINR(s.netPay)}</b>, align: 'right' }, { key: 's', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
      ]} />
      <SlipDetailModal slip={open} onClose={() => setOpen(null)} />
    </>
  );
}

function OnboardingTab({ employeeId }: { employeeId: string }) {
  const q = useMyOnboarding(employeeId);
  const update = useUpdateTask();
  return (
    <QueryBoundary query={q} empty={{ when: (d) => !d, title: 'No onboarding checklist', description: 'Onboarding starts automatically when an employee is added.' }}>
      {(o) => o && (
        <Card><CardHeader><CardTitle>Onboarding checklist</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex items-center gap-3"><Progress value={o.progress.percent} className="flex-1" tone="success" /><span className="text-caption text-muted-foreground">{o.progress.done}/{o.progress.total}</span></div>
          <ul className="divide-y">{o.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5"><input type="checkbox" className="h-4 w-4 accent-primary" checked={t.status === 'COMPLETED'} onChange={(e) => update.mutate({ id: t.id, status: e.target.checked ? 'COMPLETED' : 'PENDING' })} aria-label={t.title} />
              <div className="min-w-0 flex-1"><p className={`text-caption ${t.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{t.title}</p><p className="text-fine text-muted-foreground">{t.assignedTo ?? '-'}{t.dueDate ? ` · due ${formatDate(t.dueDate, false)}` : ''}</p></div><StatusBadge status={t.status} /></li>
          ))}</ul>
        </CardContent></Card>
      )}
    </QueryBoundary>
  );
}

function Header({ e }: { e: Employee }) {
  const status = useSetEmployeeStatus(e.id);
  const reset = useResetEmployeePassword(e.id);
  const { hasRole } = useAuth();
  const [confirm, setConfirm] = React.useState<'deactivate' | 'activate' | null>(null);
  const [tmp, setTmp] = React.useState<string | null>(null);
  const admin = hasRole(ADMIN);
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4"><UserAvatar name={e.fullName} className="h-16 w-16 text-tagline" />
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-tagline font-semibold">{e.fullName}</h1><StatusBadge status={e.status} /></div>
            <p className="text-caption text-muted-foreground">{e.designation?.name ?? '-'} · {e.department?.name ?? '-'} · {e.employeeCode}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground"><span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{e.email}</span>{e.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{e.phone}</span>}{(e.workLocation || e.city) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.workLocation ?? e.city}</span>}</div></div></div>
        {admin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: (r) => setTmp(r.temporaryPassword) })}><KeyRound className="mr-1.5 h-4 w-4" />Reset password</Button>
            {e.status === 'ACTIVE' ? <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirm('deactivate')}><UserX className="mr-1.5 h-4 w-4" />Deactivate</Button> : e.status !== 'LEFT' && <Button variant="outline" size="sm" onClick={() => setConfirm('activate')}>Reactivate</Button>}
          </div>
        )}
      </div>
      <ConfirmModal open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title={confirm === 'deactivate' ? 'Deactivate employee?' : 'Reactivate employee?'} description={confirm === 'deactivate' ? 'They will be signed out and unable to log in. Use Separation for a proper exit with full & final settlement.' : 'They will be able to sign in again.'} confirmLabel={confirm === 'deactivate' ? 'Deactivate' : 'Reactivate'} destructive={confirm === 'deactivate'} loading={status.isPending}
        onConfirm={() => status.mutate(confirm === 'deactivate' ? 'INACTIVE' : 'ACTIVE', { onSuccess: () => setConfirm(null) })} />
      <Modal open={!!tmp} onOpenChange={(o) => !o && setTmp(null)} size="sm" title="Password reset" description="Share this temporary password securely. They must change it at next sign-in."><p className="rounded-md bg-muted p-3 text-center font-mono text-tagline font-semibold">{tmp}</p><Button variant="outline" onClick={() => { navigator.clipboard.writeText(tmp ?? ''); toast.success('Copied'); }}>Copy</Button></Modal>
    </Card>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasRole } = useAuth();
  const q = useEmployee(id);
  const update = useUpdateEmployee(id);
  const admin = hasRole(ADMIN);
  const payroll = hasRole(PAYROLL);
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => router.push('/hr/employees')}><ArrowLeft className="mr-1 h-4 w-4" />All employees</Button>
      <QueryBoundary query={q} rows={6}>
        {(e) => (
          <>
            <Header e={e} />
            <Tabs defaultValue="overview">
              <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger>{payroll && <TabsTrigger value="comp">Compensation</TabsTrigger>}<TabsTrigger value="leave">Leave</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger>{payroll && <TabsTrigger value="slips">Payslips</TabsTrigger>}<TabsTrigger value="docs">Documents</TabsTrigger><TabsTrigger value="onboarding">Onboarding</TabsTrigger>{admin && <TabsTrigger value="edit">Edit</TabsTrigger>}</TabsList>
              <TabsContent value="overview" className="mt-4 space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label="Joined" value={formatDate(e.dateOfJoining, false)} hint={formatDate(e.dateOfJoining).slice(-4)} /><StatCard label="Annual CTC" value={e.ctc ? formatINR(e.ctc) : '-'} hint={payroll || admin ? undefined : 'Restricted'} />
                  <StatCard label="System role" value={e.user.role.replace('_', ' ').toLowerCase()} hint={e.user.mfaEnabled ? '2FA on' : '2FA off'} /><StatCard label="Last login" value={e.user.lastLogin ? formatDate(e.user.lastLogin, false) : 'Never'} />
                </div>
                <Card><CardHeader><CardTitle>Employment & personal</CardTitle></CardHeader><CardContent><DetailList cols={3} items={[
                  { label: 'Reporting manager', value: e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : null }, { label: 'Employment type', value: e.employmentType }, { label: 'Notice period', value: `${e.noticeperiodDays ?? '-'} days` },
                  { label: 'Date of birth', value: formatDate(e.dateOfBirth) }, { label: 'Gender', value: e.gender }, { label: 'Marital status', value: e.maritalStatus }, { label: 'Address', value: [e.currentAddress, e.city, e.state, e.pincode].filter(Boolean).join(', ') }, { label: 'Blood group', value: e.bloodGroup },
                  { label: 'Emergency contact', value: e.emergencyContactName ? `${e.emergencyContactName} · ${e.emergencyContactPhone ?? ''}` : null },
                ]} /></CardContent></Card>
                <Card><CardHeader><CardTitle>Statutory & bank</CardTitle></CardHeader><CardContent><DetailList cols={3} items={[
                  { label: 'PAN', value: e.panNumber }, { label: 'Aadhaar', value: e.aadhaarNumber }, { label: 'UAN', value: e.uanNumber }, { label: 'Bank', value: e.bankName }, { label: 'Account number', value: e.bankAccountNumber }, { label: 'IFSC', value: e.ifscCode },
                  { label: 'Professional tax state', value: e.professionalTaxState }, { label: 'PF / ESI / PT', value: [e.pfApplicable && 'PF', e.esiApplicable && 'ESI', e.ptApplicable && 'PT'].filter(Boolean).join(' · ') || 'None' },
                ]} /></CardContent></Card>
                {e.reportees && e.reportees.length > 0 && <Card><CardHeader><CardTitle>Direct reports ({e.reportees.length})</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{e.reportees.map((r) => <Button key={r.id} variant="outline" size="sm" onClick={() => router.push(`/hr/employees/${r.id}`)}>{r.firstName} {r.lastName}</Button>)}</CardContent></Card>}
              </TabsContent>
              {payroll && <TabsContent value="comp" className="mt-4"><CompensationTab employeeId={e.id} currentCtc={e.ctc} /></TabsContent>}
              <TabsContent value="leave" className="mt-4"><LeaveTab employeeId={e.id} /></TabsContent>
              <TabsContent value="attendance" className="mt-4"><AttendanceTab employeeId={e.id} /></TabsContent>
              {payroll && <TabsContent value="slips" className="mt-4"><PayslipsTab employeeId={e.id} /></TabsContent>}
              <TabsContent value="docs" className="mt-4"><DocumentsCard employeeId={e.id} canVerify={admin} canUpload={admin} /></TabsContent>
              <TabsContent value="onboarding" className="mt-4"><OnboardingTab employeeId={e.id} /></TabsContent>
              {admin && <TabsContent value="edit" className="mt-4"><EmployeeForm mode="edit" initial={e} submitting={update.isPending} onCancel={() => undefined} onSubmit={(d) => update.mutate(d)} /></TabsContent>}
            </Tabs>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
