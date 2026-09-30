'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DecisionButtons } from '@/components/approvals/decision-buttons';
import { DataTable } from '@/components/common/data-table';
import { Modal } from '@/components/common/modal';
import { MonthPicker } from '@/components/common/month-picker';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useCreateRun, useDecideDeclaration, useDeclarations, useRuns } from '@/hooks/payroll/use-payroll';
import { formatDate, formatINR, monthLabel } from '@/lib/format';
import { PAYROLL } from '@/lib/permissions';
import type { RunResult } from '@/types/payroll';

export default function PayrollPage() {
  const router = useRouter();
  const { hasRole } = useAuth();
  const canRun = hasRole(PAYROLL);
  const runs = useRuns();
  const create = useCreateRun();
  const decls = useDeclarations('PENDING');
  const decide = useDecideDeclaration();
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [ym, setYm] = React.useState({ m: prev.getMonth() + 1, y: prev.getFullYear() });
  const [lop, setLop] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [result, setResult] = React.useState<RunResult | null>(null);
  return (
    <>
      <PageHeader title="Payroll" description="Monthly runs with PF, ESI, professional tax, LWF and TDS. Generate → review → approve → pay." actions={canRun && <Button onClick={() => setOpen(true)}><Play className="mr-2 h-4 w-4" />Run payroll</Button>} />
      <Tabs defaultValue="runs">
        <TabsList><TabsTrigger value="runs">Payroll runs</TabsTrigger><TabsTrigger value="declarations">Tax declarations{decls.data && decls.data.length > 0 && <Badge variant="warning" className="ml-2 px-1.5 py-0">{decls.data.length}</Badge>}</TabsTrigger></TabsList>
        <TabsContent value="runs" className="mt-4">
          <DataTable rows={runs.data} loading={runs.isLoading} error={runs.error} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/hr/payroll/runs/${r.id}`)} emptyTitle="No payroll runs yet" emptyDescription="Run payroll for a month once salary structures are assigned to employees." columns={[
            { key: 'm', header: 'Month', cell: (r) => <span className="font-semibold">{monthLabel(r.month, r.year)}</span> }, { key: 'e', header: 'Employees', cell: (r) => r.employeeCount, align: 'right' },
            { key: 'g', header: 'Gross', cell: (r) => formatINR(r.totalGross), align: 'right' }, { key: 'n', header: 'Net pay', cell: (r) => <b className="tabular-nums">{formatINR(r.totalNet)}</b>, align: 'right' },
            { key: 'c', header: 'Employer contrib.', cell: (r) => formatINR(r.totalEmployerContribution), align: 'right', hideOnMobile: true }, { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]} />
        </TabsContent>
        <TabsContent value="declarations" className="mt-4">
          <DataTable rows={decls.data} loading={decls.isLoading} error={decls.error} rowKey={(d) => d.id} emptyTitle="No declarations awaiting review" columns={[
            { key: 'e', header: 'Employee', cell: (d) => `${d.employee?.firstName} ${d.employee?.lastName} (${d.employee?.employeeCode})` }, { key: 'r', header: 'Regime', cell: (d) => (d.taxRegime === 'NEW' ? 'New' : 'Old') },
            { key: 'a', header: 'Declared', cell: (d) => formatINR(d.totalDeclaredAmount), align: 'right' }, { key: 'rent', header: 'Rent / month', cell: (d) => (d.monthlyRent ? formatINR(d.monthlyRent) : '-'), align: 'right', hideOnMobile: true },
            { key: 'd', header: 'Sections', cell: (d) => <span className="text-fine text-muted-foreground">{d.details.map((x) => `${x.subCategory.name}: ${formatINR(x.declaredAmount)}`).join(' · ') || '-'}</span>, hideOnMobile: true },
            { key: 'x', header: '', cell: (d) => <DecisionButtons subject={`${d.employee?.firstName}: ${formatINR(d.totalDeclaredAmount)} declared`} busy={decide.isPending} onApprove={() => decide.mutate({ id: d.id, action: 'approve' })} onReject={() => decide.mutate({ id: d.id, action: 'reject' })} /> },
          ]} />
        </TabsContent>
      </Tabs>

      <Modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }} title={result ? 'Payroll generated' : 'Run payroll'} description={result ? undefined : 'Salary slips are generated as drafts: nothing is final until you approve.'}>
        {!result ? (
          <div className="space-y-4">
            <MonthPicker month={ym.m} year={ym.y} onChange={(m, y) => setYm({ m, y })} />
            <label className="flex items-start gap-2 text-caption"><Checkbox checked={lop} onCheckedChange={setLop} className="mt-0.5" /><span>Treat working days with no attendance record as loss of pay<span className="block text-fine text-muted-foreground">Off by default: unmarked days are paid and flagged. Use “Mark unmarked days absent” under Attendance → Tools for finer control.</span></span></label>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={create.isPending} onClick={() => create.mutate({ month: ym.m, year: ym.y, treatUnmarkedAsLop: lop }, { onSuccess: setResult })}>{create.isPending ? 'Generating…' : 'Generate slips'}</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-caption"><b>{result.generated}</b> salary slips generated for {monthLabel(result.run.month, result.run.year)}. Total net pay <b>{formatINR(result.run.totalNet)}</b>.</p>
            {result.skipped.length > 0 && <div className="rounded-md border bg-muted p-3 text-caption"><p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" />{result.skipped.length} employee(s) skipped</p><ul className="max-h-40 space-y-0.5 overflow-y-auto text-fine">{result.skipped.map((s) => <li key={s.employeeId}>{s.name} ({s.employeeCode}): {s.reason}</li>)}</ul></div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button onClick={() => router.push(`/hr/payroll/runs/${result.run.id}`)}>Review & approve</Button></div>
          </div>
        )}
      </Modal>
    </>
  );
}
