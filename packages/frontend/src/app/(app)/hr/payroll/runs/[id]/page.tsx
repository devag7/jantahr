'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Check, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/common/data-table';
import { ConfirmModal } from '@/components/common/modal';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { SlipDetailModal } from '@/components/payroll/slip-detail';
import { useAuth } from '@/hooks/auth/use-auth';
import { useDeleteRun, useRun, useRunAction } from '@/hooks/payroll/use-payroll';
import { formatINR, monthLabel } from '@/lib/format';
import { PAYROLL } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { PayrollStatus, Slip } from '@/types/payroll';

const STEPS: PayrollStatus[] = ['GENERATED', 'APPROVED', 'PAID'];

export default function PayrollRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasRole } = useAuth();
  const canAct = hasRole(PAYROLL);
  const q = useRun(id);
  const action = useRunAction();
  const del = useDeleteRun();
  const [slip, setSlip] = React.useState<Slip | null>(null);
  const [confirm, setConfirm] = React.useState<'approve' | 'paid' | 'reopen' | 'delete' | null>(null);
  const [lop, setLop] = React.useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => router.push('/hr/payroll')}><ArrowLeft className="mr-1 h-4 w-4" />All runs</Button>
      <QueryBoundary query={q} rows={6}>
        {(run) => {
          const step = STEPS.indexOf(run.status);
          const withWarnings = run.slips.filter((s) => s.remarks);
          const negative = run.slips.filter((s) => s.netPay < 0);
          return (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h1 className="text-display-sm font-semibold sm:text-title">{monthLabel(run.month, run.year)} payroll</h1><p className="mt-1 text-caption text-muted-foreground">{run.employeeCount} employees</p></div>
                {canAct && (
                  <div className="flex flex-wrap items-center gap-2">
                    {run.status === 'GENERATED' && <><label className="flex items-center gap-2 text-fine text-muted-foreground"><Checkbox checked={lop} onCheckedChange={setLop} />Unmarked days = LOP</label><Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id, action: 'generate', treatUnmarkedAsLop: lop })}>{action.isPending && <Spinner className="mr-2" />}Regenerate</Button><Button disabled={action.isPending || negative.length > 0} onClick={() => setConfirm('approve')}><Check className="mr-2 h-4 w-4" />Approve payroll</Button></>}
                    {run.status === 'APPROVED' && <><Button variant="outline" onClick={() => setConfirm('reopen')}><RotateCcw className="mr-2 h-4 w-4" />Reopen</Button><Button onClick={() => setConfirm('paid')}>Mark as paid</Button></>}
                    {(run.status === 'GENERATED' || run.status === 'DRAFT') && <Button variant="ghost" size="icon" aria-label="Delete run" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                )}
              </div>

              <ol className="flex items-center gap-2 text-caption" aria-label="Payroll progress">
                {(['Generated', 'Approved', 'Paid'] as const).map((l, i) => (
                  <li key={l} className="flex items-center gap-2"><span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-fine font-semibold', i <= step ? 'bg-muted text-success' : 'bg-muted text-muted-foreground')}>{i <= step ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="done" /> : i + 1}</span><span className={i <= step ? 'font-semibold' : 'text-muted-foreground'}>{l}</span>{i < 2 && <span className="mx-2 h-px w-8 bg-border" />}</li>
                ))}
              </ol>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Gross pay" value={formatINR(run.totalGross)} /><StatCard label="Deductions" value={formatINR(run.totalDeductions)} /><StatCard label="Net pay" value={formatINR(run.totalNet)} tone="success" /><StatCard label="Employer contributions" value={formatINR(run.totalEmployerContribution)} hint="PF, EDLI, admin, ESI, LWF" tone="info" />
              </div>

              {(withWarnings.length > 0 || negative.length > 0) && (
                <Card className="p-4 text-caption"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" />{negative.length ? `${negative.length} slip(s) have negative net pay: fix before approving` : `${withWarnings.length} slip(s) have warnings`}</p>
                  <ul className="mt-2 space-y-0.5 text-fine">{Array.from(new Map([...negative, ...withWarnings].map((s) => [s.id, s] as const)).values()).slice(0, 8).map((s) => <li key={s.id}><b>{s.employee?.name}</b>: {s.remarks ?? 'Negative net pay'}</li>)}</ul></Card>
              )}

              <DataTable rows={run.slips} rowKey={(s) => s.id} onRowClick={setSlip} dense emptyTitle="No slips" columns={[
                { key: 'e', header: 'Employee', cell: (s) => <div><p className="font-semibold">{s.employee?.name}</p><p className="text-fine text-muted-foreground">{s.employee?.employeeCode} · {s.employee?.department ?? '-'}</p></div> },
                { key: 'p', header: 'Paid days', cell: (s) => <span className={s.leaveWithoutPay + s.absentDays > 0 ? 'font-semibold text-destructive' : ''}>{s.paymentDays}</span>, align: 'right', hideOnMobile: true },
                { key: 'g', header: 'Gross', cell: (s) => formatINR(s.grossPay), align: 'right' }, { key: 'pf', header: 'PF', cell: (s) => formatINR(s.pfEmployee), align: 'right', hideOnMobile: true },
                { key: 'esi', header: 'ESI', cell: (s) => (s.esiEmployee ? formatINR(s.esiEmployee) : '-'), align: 'right', hideOnMobile: true }, { key: 'pt', header: 'PT', cell: (s) => (s.professionalTax ? formatINR(s.professionalTax) : '-'), align: 'right', hideOnMobile: true },
                { key: 'tds', header: 'TDS', cell: (s) => (s.tds ? formatINR(s.tds) : '-'), align: 'right' }, { key: 'n', header: 'Net pay', cell: (s) => <b className={cn('tabular-nums', s.netPay < 0 && 'text-destructive')}>{formatINR(s.netPay)}</b>, align: 'right' },
                { key: 'w', header: '', cell: (s) => (s.remarks ? <AlertTriangle className="h-4 w-4 text-warning" aria-label="Has warnings" /> : null) },
              ]} />
              {run.status !== 'GENERATED' && run.status !== 'DRAFT' && <p className="text-caption text-muted-foreground">Download statutory & bank files for this month from <Link href="/hr/payroll/statutory" className="text-primary hover:underline">Statutory & bank</Link>.</p>}

              <SlipDetailModal slip={slip} onClose={() => setSlip(null)} />
              <ConfirmModal open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} destructive={confirm === 'delete'} loading={action.isPending || del.isPending}
                title={{ approve: 'Approve this payroll?', paid: 'Mark payroll as paid?', reopen: 'Reopen this payroll?', delete: 'Delete this run?', '': '' }[confirm ?? '']}
                description={{ approve: 'Employees will be notified and payslips published. Leave/attendance for this month become locked, loan instalments advance and approved expenses are marked reimbursed.', paid: 'Confirm the salary has been transferred to employees’ bank accounts.', reopen: 'Slips return to “Generated” and loan/expense effects are reversed so you can correct and regenerate.', delete: 'The draft salary slips will be removed.', '': '' }[confirm ?? '']}
                confirmLabel={{ approve: 'Approve', paid: 'Mark paid', reopen: 'Reopen', delete: 'Delete', '': '' }[confirm ?? '']}
                onConfirm={() => { if (confirm === 'delete') del.mutate(id, { onSuccess: () => router.push('/hr/payroll') }); else if (confirm) action.mutate({ id, action: confirm }, { onSuccess: () => setConfirm(null) }); }} />
            </div>
          );
        }}
      </QueryBoundary>
    </>
  );
}
