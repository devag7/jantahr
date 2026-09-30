'use client';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DecisionButtons } from '@/components/approvals/decision-buttons';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { AppraisalModal } from '@/components/performance/appraisal-modal';
import { useAttendanceRequests, useDecideRequest } from '@/hooks/attendance/use-attendance';
import { useClaims, useDecideClaim, useDecideTravel, useTravel } from '@/hooks/expenses/use-expenses';
import { useApproveLeave, useCompOff, useDecideCompOff, useLeavePending, useRejectLeave } from '@/hooks/leave/use-leave';
import { usePendingAppraisals } from '@/hooks/performance/use-performance';
import { formatDate, formatINR } from '@/lib/format';

const who = (e: { firstName: string; lastName: string; employeeCode?: string }) => <div><p className="font-semibold">{e.firstName} {e.lastName}</p>{e.employeeCode && <p className="text-fine text-muted-foreground">{e.employeeCode}</p>}</div>;
const Count = ({ n }: { n: number }) => (n > 0 ? <Badge variant="warning" className="ml-2 px-1.5 py-0">{n}</Badge> : null);

export default function ApprovalsPage() {
  const leave = useLeavePending();
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const att = useAttendanceRequests('PENDING', 'approvals');
  const decideAtt = useDecideRequest();
  const claims = useClaims('team', 'SUBMITTED');
  const decideClaim = useDecideClaim();
  const travel = useTravel('team');
  const decideTravel = useDecideTravel();
  const comp = useCompOff('approvals');
  const decideComp = useDecideCompOff();
  const appraisals = usePendingAppraisals();
  const [appraisalId, setAppraisalId] = React.useState<string | undefined>();
  const pendingTravel = travel.data?.filter((t) => t.status === 'PENDING');
  const pendingComp = comp.data?.filter((c) => c.status === 'PENDING');

  return (
    <>
      <PageHeader title="Approvals" description="Requests waiting for your decision." />
      <Tabs defaultValue="leave">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="leave">Leave<Count n={leave.data?.length ?? 0} /></TabsTrigger>
          <TabsTrigger value="attendance">Attendance<Count n={att.data?.length ?? 0} /></TabsTrigger>
          <TabsTrigger value="expenses">Expenses<Count n={claims.data?.length ?? 0} /></TabsTrigger>
          <TabsTrigger value="travel">Travel<Count n={pendingTravel?.length ?? 0} /></TabsTrigger>
          <TabsTrigger value="comp">Comp-off<Count n={pendingComp?.length ?? 0} /></TabsTrigger>
          <TabsTrigger value="appraisals">Appraisals<Count n={appraisals.data?.length ?? 0} /></TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="mt-4">
          <DataTable rows={leave.data} loading={leave.isLoading} error={leave.error} rowKey={(l) => l.id} emptyTitle="No leave requests to approve" columns={[
            { key: 'e', header: 'Employee', cell: (l) => who(l.employee) },
            { key: 't', header: 'Leave', cell: (l) => l.leaveType.name },
            { key: 'd', header: 'Dates', cell: (l) => `${formatDate(l.fromDate, false)}${l.fromDate !== l.toDate ? ` → ${formatDate(l.toDate, false)}` : ''}${l.halfDay ? ' (half)' : ''}` },
            { key: 'n', header: 'Days', cell: (l) => l.totalLeaveDays, align: 'right' },
            { key: 'r', header: 'Reason', cell: (l) => <span className="line-clamp-2 max-w-56 text-muted-foreground">{l.reason ?? '-'}</span>, hideOnMobile: true },
            { key: 'a', header: '', cell: (l) => <DecisionButtons subject={`${l.employee.firstName}: ${l.leaveType.name}, ${l.totalLeaveDays} day(s)`} busy={approveLeave.isPending || rejectLeave.isPending} onApprove={(c) => approveLeave.mutate({ id: l.id, comment: c })} onReject={(c) => rejectLeave.mutate({ id: l.id, comment: c })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <DataTable rows={att.data} loading={att.isLoading} error={att.error} rowKey={(r) => r.id} emptyTitle="No attendance requests" columns={[
            { key: 'e', header: 'Employee', cell: (r) => who(r.employee) },
            { key: 't', header: 'Type', cell: (r) => <span className="capitalize">{r.requestType.replace('_', ' ').toLowerCase()}</span> },
            { key: 'd', header: 'Dates', cell: (r) => `${formatDate(r.fromDate, false)}${r.toDate !== r.fromDate ? ` → ${formatDate(r.toDate, false)}` : ''}` },
            { key: 'r', header: 'Reason', cell: (r) => <span className="line-clamp-2 max-w-64">{r.reason}</span>, hideOnMobile: true },
            { key: 'a', header: '', cell: (r) => <DecisionButtons subject={`${r.employee.firstName}: ${r.requestType.toLowerCase()}`} busy={decideAtt.isPending} onApprove={(c) => decideAtt.mutate({ id: r.id, action: 'approve', comment: c })} onReject={(c) => decideAtt.mutate({ id: r.id, action: 'reject', comment: c })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <DataTable rows={claims.data} loading={claims.isLoading} error={claims.error} rowKey={(c) => c.id} emptyTitle="No expense claims to approve" columns={[
            { key: 'e', header: 'Employee', cell: (c) => who(c.employee) },
            { key: 't', header: 'Claim', cell: (c) => <div><p className="font-semibold">{c.title}</p><p className="text-fine text-muted-foreground">{c.items.map((i) => i.category).join(', ')}</p></div> },
            { key: 'a', header: 'Amount', cell: (c) => formatINR(c.totalClaimed), align: 'right' },
            { key: 'x', header: '', cell: (c) => <DecisionButtons subject={`${c.title}: ${formatINR(c.totalClaimed)}`} busy={decideClaim.isPending} onApprove={(cm) => decideClaim.mutate({ id: c.id, action: 'approve', comment: cm })} onReject={(cm) => decideClaim.mutate({ id: c.id, action: 'reject', comment: cm })} requireReason /> },
          ]} />
        </TabsContent>

        <TabsContent value="travel" className="mt-4">
          <DataTable rows={pendingTravel} loading={travel.isLoading} error={travel.error} rowKey={(t) => t.id} emptyTitle="No travel requests" columns={[
            { key: 'e', header: 'Employee', cell: (t) => who(t.employee) },
            { key: 'p', header: 'Purpose', cell: (t) => <div><p className="font-semibold">{t.purpose}</p><p className="text-fine text-muted-foreground">{t.fromLocation} → {t.toLocation}</p></div> },
            { key: 'd', header: 'Dates', cell: (t) => `${formatDate(t.departureDate, false)} - ${formatDate(t.returnDate, false)}` },
            { key: 'c', header: 'Est. cost', cell: (t) => (t.estimatedCost ? formatINR(t.estimatedCost) : '-'), align: 'right' },
            { key: 'a', header: '', cell: (t) => <DecisionButtons subject={t.purpose} busy={decideTravel.isPending} onApprove={() => decideTravel.mutate({ id: t.id, action: 'approve' })} onReject={() => decideTravel.mutate({ id: t.id, action: 'reject' })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="comp" className="mt-4">
          <DataTable rows={pendingComp} loading={comp.isLoading} error={comp.error} rowKey={(c) => c.id} emptyTitle="No comp-off requests" columns={[
            { key: 'e', header: 'Employee', cell: (c) => who(c.employee) },
            { key: 'd', header: 'Worked on', cell: (c) => formatDate(c.workFromDate) },
            { key: 'r', header: 'Reason', cell: (c) => c.reason },
            { key: 'a', header: '', cell: (c) => <DecisionButtons subject={`Comp-off for ${formatDate(c.workFromDate)}`} busy={decideComp.isPending} onApprove={() => decideComp.mutate({ id: c.id, action: 'approve' })} onReject={() => decideComp.mutate({ id: c.id, action: 'reject' })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="appraisals" className="mt-4">
          <DataTable rows={appraisals.data} loading={appraisals.isLoading} error={appraisals.error} rowKey={(a) => a.id} emptyTitle="No appraisals to review" columns={[
            { key: 'e', header: 'Employee', cell: (a) => who(a.employee) },
            { key: 'c', header: 'Cycle', cell: (a) => a.appraisalCycle.name },
            { key: 's', header: 'Stage', cell: (a) => <StatusBadge status={a.status} /> },
            { key: 'a', header: '', align: 'right', cell: (a) => <Button size="sm" onClick={() => setAppraisalId(a.id)}>Review</Button> },
          ]} />
        </TabsContent>
      </Tabs>
      <AppraisalModal id={appraisalId} onClose={() => setAppraisalId(undefined)} />
    </>
  );
}
