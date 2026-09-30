'use client';
import * as React from 'react';
import { Plus, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { CHART_COLORS } from '@/components/charts/charts';
import { AppraisalModal } from '@/components/performance/appraisal-modal';
import { RatingDisplay } from '@/components/performance/rating';
import { useAuth } from '@/hooks/auth/use-auth';
import { useDepartments } from '@/hooks/org/use-org';
import { useCreateCycle, useCycleAppraisals, useCycles, useCycleSummary, useLaunchCycle } from '@/hooks/performance/use-performance';
import { formatDate, todayISO } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';

export default function HrPerformancePage() {
  const { hasRole } = useAuth();
  const admin = hasRole(ADMIN);
  const cycles = useCycles();
  const [cycleId, setCycleId] = React.useState<string | undefined>();
  const selected = cycleId ?? cycles.data?.[0]?.id;
  const summary = useCycleSummary(selected);
  const appraisals = useCycleAppraisals(selected);
  const launch = useLaunchCycle();
  const [newOpen, setNewOpen] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | undefined>();
  const [launchDept, setLaunchDept] = React.useState('');
  const depts = useDepartments();
  const s = summary.data;
  const max = Math.max(1, ...Object.values(s?.ratingDistribution ?? { 0: 0 }));
  return (
    <>
      <PageHeader title="Performance" description="Appraisal cycles, review progress and rating calibration." actions={<>
        <NativeSelect aria-label="Cycle" className="w-80" value={selected ?? ''} onChange={(e) => setCycleId(e.target.value)}>{cycles.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
        {admin && <Button variant="outline" onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />New cycle</Button>}</>} />
      {!cycles.data?.length ? <p className="text-caption text-muted-foreground">No cycles yet. Create one to start appraisals.</p> : (
        <div className="space-y-6">
          {admin && selected && (
            <Card className="flex flex-wrap items-center gap-3 p-4"><Rocket className="h-5 w-5 text-primary" /><p className="mr-auto text-caption">Launch this cycle for employees: each gets a self-review task and their manager is set as reviewer.</p>
              <NativeSelect aria-label="Department" className="w-48" value={launchDept} onChange={(e) => setLaunchDept(e.target.value)}><option value="">All departments</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect>
              <Button disabled={launch.isPending} onClick={() => launch.mutate({ id: selected, departmentId: launchDept || undefined })}>Launch appraisals</Button></Card>
          )}
          {s && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-3 lg:col-span-1"><StatCard label="Appraisals" value={s.total} /><StatCard label="Average rating" value={s.averageRating ?? '-'} tone="success" /><StatCard label="Completed" value={s.byStatus.COMPLETED ?? 0} /><StatCard label="Promotions" value={s.promotions} tone="info" /></div>
              <Card className="lg:col-span-2"><CardHeader><CardTitle>Rating distribution</CardTitle></CardHeader><CardContent><div className="flex h-32 items-end gap-3">{Object.entries(s.ratingDistribution).map(([k, v]) => <div key={k} className="flex flex-1 flex-col items-center gap-1"><span className="text-fine text-muted-foreground">{v}</span><div className="w-full rounded-t" style={{ height: `${(v / max) * 100}%`, minHeight: 4, background: CHART_COLORS[0] }} /><span className="text-fine">{k}★</span></div>)}</div></CardContent></Card>
            </div>
          )}
          <DataTable rows={appraisals.data} loading={appraisals.isLoading} error={appraisals.error} rowKey={(a) => a.id} onRowClick={(a) => setOpenId(a.id)} emptyTitle="No appraisals in this cycle" emptyDescription="Launch the cycle to create appraisals." columns={[
            { key: 'e', header: 'Employee', cell: (a) => <div><p className="font-semibold">{a.employee.firstName} {a.employee.lastName}</p><p className="text-fine text-muted-foreground">{a.employee.employeeCode} · {a.employee.designation?.name ?? '-'}</p></div> },
            { key: 's', header: 'Stage', cell: (a) => <StatusBadge status={a.status} /> }, { key: 'sr', header: 'Self', cell: (a) => <RatingDisplay value={a.selfRating} /> }, { key: 'mr', header: 'Manager', cell: (a) => <RatingDisplay value={a.managerRating} /> }, { key: 'fr', header: 'Final', cell: (a) => <RatingDisplay value={a.finalRating} /> },
            { key: 'p', header: 'Revision', cell: (a) => (a.salaryRevisionPercent ? `+${a.salaryRevisionPercent}%` : '-'), hideOnMobile: true },
          ]} />
        </div>
      )}
      <NewCycleModal open={newOpen} onOpenChange={setNewOpen} />
      <AppraisalModal id={openId} onClose={() => setOpenId(undefined)} />
    </>
  );
}

function NewCycleModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateCycle();
  const y = new Date().getFullYear();
  const [f, setF] = React.useState({ name: '', startDate: todayISO(), endDate: `${y}-12-31` });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New appraisal cycle" size="sm">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(f, { onSuccess: () => onOpenChange(false) }); }}>
        <Field label="Name" htmlFor="cn" required><Input id="cn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Annual Review FY 2026-27" /></Field>
        <FormGrid><Field label="Start" htmlFor="cs"><Input id="cs" type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field><Field label="End" htmlFor="ce"><Input id="ce" type="date" required min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field></FormGrid>
        <p className="text-fine text-muted-foreground">Starts {formatDate(f.startDate)}.</p>
        <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Create</Button></div>
      </form>
    </Modal>
  );
}
