'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/common/data-table';
import { ConfirmModal } from '@/components/common/modal';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useAnonymiseApplicants, usePrivacyOverview, useRetention } from '@/hooks/privacy/use-privacy';
import { formatDate } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import type { RetentionRow } from '@/types/privacy';
import { EraseModal } from './erase-modal';

export function AdminRetention() {
  const { hasRole } = useAuth();
  const canAct = hasRole(ADMIN);
  const q = useRetention();
  const [row, setRow] = React.useState<RetentionRow | null>(null);
  return (
    <div className="space-y-6">
      <QueryBoundary query={q} rows={2}>
        {(d) => (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Employees who left" value={d.summary.left} />
              <StatCard label="Partial erasure possible" value={d.summary.pendingPartial} hint="Inside retention window" tone="warning" />
              <StatCard label="Ready to anonymise" value={d.summary.pendingFull} hint={`Past ${d.retentionYears} years`} tone={d.summary.pendingFull ? 'destructive' : 'default'} />
              <StatCard label="Anonymised" value={d.summary.anonymised} tone="success" />
            </div>
            <DataTable rows={d.employees} rowKey={(e) => e.id} emptyTitle="No one has left yet" emptyDescription="Employees appear here after separation, with what can be erased and when statutory records may be anonymised."
              columns={[
                { key: 'e', header: 'Employee', cell: (e) => <div><p className="font-semibold">{e.anonymizedAt ? 'Anonymised record' : `${e.firstName} ${e.lastName}`}</p><p className="text-fine text-muted-foreground">{e.employeeCode}</p></div> },
                { key: 'l', header: 'Left on', cell: (e) => (e.lastWorkingDate ? formatDate(e.lastWorkingDate) : '-'), hideOnMobile: true },
                { key: 'r', header: 'Keep statutory data until', cell: (e) => (e.plan.retainUntil ? formatDate(e.plan.retainUntil) : '-'), hideOnMobile: true },
                { key: 's', header: 'State', cell: (e) => (e.anonymizedAt ? <StatusBadge status="COMPLETED" label="Anonymised" /> : e.erasedAt ? <StatusBadge status="IN_PROGRESS" label="Partly erased" /> : <StatusBadge status="NOT_ASKED" label="Held" />) },
                { key: 'a', header: '', align: 'right', cell: (e) => canAct && !e.anonymizedAt && e.plan.allowed ? <Button size="sm" variant="outline" onClick={() => setRow(e)}>{e.plan.level === 'FULL' ? 'Anonymise…' : 'Erase…'}</Button> : null },
              ]} />
          </>
        )}
      </QueryBoundary>
      {canAct && <ApplicantsCard />}
      <EraseModal row={row} onOpenChange={(o) => !o && setRow(null)} />
    </div>
  );
}

function ApplicantsCard() {
  const overview = usePrivacyOverview();
  const run = useAnonymiseApplicants();
  const [months, setMonths] = React.useState('12');
  const [confirm, setConfirm] = React.useState(false);
  return (
    <Card>
      <CardHeader><CardTitle>Job applicants</CardTitle><CardDescription>Unsuccessful candidates’ names, contact details, résumés and salary expectations should not be kept forever. Hired candidates are never touched. Applicants older than 12 months are anonymised automatically every night; use this to apply a shorter period now.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <label className="text-caption">Anonymise applicants older than <Input type="number" min="6" max="120" className="mx-2 inline-block w-20" value={months} onChange={(e) => setMonths(e.target.value)} /> months</label>
        <Button variant="outline" disabled={run.isPending || Number(months) < 6} onClick={() => setConfirm(true)}>Anonymise…</Button>
        {overview.data && <span className="text-caption text-muted-foreground">{overview.data.applicantsDue} applicant(s) are older than 12 months</span>}
      </CardContent>
      <ConfirmModal open={confirm} onOpenChange={setConfirm} destructive title="Anonymise old applicants?" description={`All non-hired applicants older than ${months} months lose their name, email, phone, résumé and salary details. This cannot be undone.`} confirmLabel="Anonymise" loading={run.isPending}
        onConfirm={() => run.mutate(Number(months), { onSuccess: () => setConfirm(false) })} />
    </Card>
  );
}
