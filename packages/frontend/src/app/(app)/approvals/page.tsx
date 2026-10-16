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
import { useAuth } from '@/hooks/auth/use-auth';
import { useAttendanceRequests, useDecideRequest } from '@/hooks/attendance/use-attendance';
import { useFeatureAccess } from '@/hooks/billing/use-billing';
import { useClaims, useDecideClaim, useDecideTravel, useTravel } from '@/hooks/expenses/use-expenses';
import { useApproveLeave, useCompOff, useDecideCompOff, useLeavePending, useRejectLeave } from '@/hooks/leave/use-leave';
import { useDecideSeparation, useSeparations } from '@/hooks/lifecycle/use-lifecycle';
import { useDecideGoal, usePendingAppraisals, usePendingGoals } from '@/hooks/performance/use-performance';
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
  const goals = usePendingGoals();
  const decideGoal = useDecideGoal();
  const seps = useSeparations();
  const decideSep = useDecideSeparation();
  const { user } = useAuth();
  const [appraisalId, setAppraisalId] = React.useState<string | undefined>();
  const pendingTravel = travel.data?.filter((t) => t.status === 'PENDING');
  const pendingComp = comp.data?.filter((c) => c.status === 'PENDING');
  // the list also holds the viewer's own resignation, which someone else decides
  const pendingSeps = seps.data?.filter((x) => x.status === 'PENDING' && x.employee.id !== user?.employee?.id);
  // plan-gated areas only show a tab when the company's plan has them (the API answers 402 otherwise)
  const has = { expenses: useFeatureAccess('expenses') !== 'none', performance: useFeatureAccess('performance') !== 'none', lifecycle: useFeatureAccess('lifecycle') !== 'none' };

  return (
    <>
      <PageHeader title="Approvals" description="Requests waiting for your decision." />
      <Tabs defaultValue="leave">
        <TabsList className="justify-start">
          <TabsTrigger value="leave">Leave<Count n={leave.data?.length ?? 0} /></TabsTrigger>
          <TabsTrigger value="attendance">Attendance<Count n={att.data?.length ?? 0} /></TabsTrigger>
          {has.expenses && <TabsTrigger value="expenses">Expenses<Count n={claims.data?.length ?? 0} /></TabsTrigger>}
          {has.expenses && <TabsTrigger value="travel">Travel<Count n={pendingTravel?.length ?? 0} /></TabsTrigger>}
          <TabsTrigger value="comp">Comp-off<Count n={pendingComp?.length ?? 0} /></TabsTrigger>
          {has.performance && <TabsTrigger value="goals">Goals<Count n={goals.data?.length ?? 0} /></TabsTrigger>}
          {has.performance && <TabsTrigger value="appraisals">Appraisals<Count n={appraisals.data?.length ?? 0} /></TabsTrigger>}
          {has.lifecycle && <TabsTrigger value="resignations">Resignations<Count n={pendingSeps?.length ?? 0} /></TabsTrigger>}
        </TabsList>

        <TabsContent value="leave" className="mt-4">
          <DataTable stackOnMobile rows={leave.data} loading={leave.isLoading} error={leave.error} rowKey={(l) => l.id} emptyTitle="No leave requests to approve" columns={[
            { key: 'e', header: 'Employee', cell: (l) => who(l.employee) },
            { key: 't', header: 'Leave', cell: (l) => l.leaveType.name },
            { key: 'd', header: 'Dates', cell: (l) => `${formatDate(l.fromDate, false)}${l.fromDate !== l.toDate ? ` → ${formatDate(l.toDate, false)}` : ''}${l.halfDay ? ' (half)' : ''}` },
            { key: 'n', header: 'Days', cell: (l) => l.totalLeaveDays, align: 'right' },
            { key: 'r', header: 'Reason', cell: (l) => <span className="line-clamp-2 max-w-56 text-muted-foreground">{l.reason ?? '-'}</span>, hideOnMobile: true },
            { key: 'a', header: '', cell: (l) => <DecisionButtons subject={`${l.employee.firstName}: ${l.leaveType.name}, ${l.totalLeaveDays} day(s)`} busy={approveLeave.isPending || rejectLeave.isPending} onApprove={(c) => approveLeave.mutate({ id: l.id, comment: c })} onReject={(c) => rejectLeave.mutate({ id: l.id, comment: c })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <DataTable stackOnMobile rows={att.data} loading={att.isLoading} error={att.error} rowKey={(r) => r.id} emptyTitle="No attendance requests" columns={[
            { key: 'e', header: 'Employee', cell: (r) => who(r.employee) },
            { key: 't', header: 'Type', cell: (r) => <span className="capitalize">{r.requestType.replace('_', ' ').toLowerCase()}</span> },
            { key: 'd', header: 'Dates', cell: (r) => `${formatDate(r.fromDate, false)}${r.toDate !== r.fromDate ? ` → ${formatDate(r.toDate, false)}` : ''}` },
            { key: 'r', header: 'Reason', cell: (r) => <span className="line-clamp-2 max-w-64">{r.reason}</span>, hideOnMobile: true },
            { key: 'a', header: '', cell: (r) => <DecisionButtons subject={`${r.employee.firstName}: ${r.requestType.toLowerCase()}`} busy={decideAtt.isPending} onApprove={(c) => decideAtt.mutate({ id: r.id, action: 'approve', comment: c })} onReject={(c) => decideAtt.mutate({ id: r.id, action: 'reject', comment: c })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <DataTable stackOnMobile rows={claims.data} loading={claims.isLoading} error={claims.error} rowKey={(c) => c.id} emptyTitle="No expense claims to approve" columns={[
            { key: 'e', header: 'Employee', cell: (c) => who(c.employee) },
            { key: 't', header: 'Claim', cell: (c) => <div><p className="font-semibold">{c.title}</p><p className="text-fine text-muted-foreground">{c.items.map((i) => i.category).join(', ')}</p></div> },
            { key: 'a', header: 'Amount', cell: (c) => formatINR(c.totalClaimed), align: 'right' },
            { key: 'x', header: '', cell: (c) => <DecisionButtons subject={`${c.title}: ${formatINR(c.totalClaimed)}`} busy={decideClaim.isPending} onApprove={(cm) => decideClaim.mutate({ id: c.id, action: 'approve', comment: cm })} onReject={(cm) => decideClaim.mutate({ id: c.id, action: 'reject', comment: cm })} requireReason /> },
          ]} />
        </TabsContent>

        <TabsContent value="travel" className="mt-4">
          <DataTable stackOnMobile rows={pendingTravel} loading={travel.isLoading} error={travel.error} rowKey={(t) => t.id} emptyTitle="No travel requests" columns={[
            { key: 'e', header: 'Employee', cell: (t) => who(t.employee) },
            { key: 'p', header: 'Purpose', cell: (t) => <div><p className="font-semibold">{t.purpose}</p><p className="text-fine text-muted-foreground">{t.fromLocation} → {t.toLocation}</p></div> },
            { key: 'd', header: 'Dates', cell: (t) => `${formatDate(t.departureDate, false)} - ${formatDate(t.returnDate, false)}` },
            { key: 'c', header: 'Est. cost', cell: (t) => (t.estimatedCost ? formatINR(t.estimatedCost) : '-'), align: 'right' },
            { key: 'a', header: '', cell: (t) => <DecisionButtons subject={t.purpose} busy={decideTravel.isPending} onApprove={(cm) => decideTravel.mutate({ id: t.id, action: 'approve', comment: cm })} onReject={(cm) => decideTravel.mutate({ id: t.id, action: 'reject', comment: cm })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="comp" className="mt-4">
          <DataTable stackOnMobile rows={pendingComp} loading={comp.isLoading} error={comp.error} rowKey={(c) => c.id} emptyTitle="No comp-off requests" columns={[
            { key: 'e', header: 'Employee', cell: (c) => who(c.employee) },
            { key: 'd', header: 'Worked on', cell: (c) => formatDate(c.workFromDate) },
            { key: 'r', header: 'Reason', cell: (c) => c.reason },
            { key: 'a', header: '', cell: (c) => <DecisionButtons subject={`Comp-off for ${formatDate(c.workFromDate)}`} busy={decideComp.isPending} onApprove={(cm) => decideComp.mutate({ id: c.id, action: 'approve', comment: cm })} onReject={(cm) => decideComp.mutate({ id: c.id, action: 'reject', comment: cm })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <DataTable stackOnMobile rows={goals.data} loading={goals.isLoading} error={goals.error} rowKey={(g) => g.id} emptyTitle="No goals to approve" emptyDescription="Goals people set for themselves wait here until you approve them." columns={[
            { key: 'e', header: 'Employee', cell: (g) => who(g.employee) },
            { key: 'g', header: 'Goal', cell: (g) => <div><p className="font-semibold">{g.title}</p>{g.description && <p className="line-clamp-2 max-w-64 text-fine text-muted-foreground">{g.description}</p>}</div> },
            { key: 'w', header: 'Weightage', cell: (g) => `${g.weightage}%`, align: 'right' },
            { key: 'p', header: 'Period', cell: (g) => `${formatDate(g.startDate, false)} - ${formatDate(g.endDate, false)}`, hideOnMobile: true },
            { key: 'a', header: '', cell: (g) => <DecisionButtons subject={`${g.employee.firstName}: ${g.title}`} busy={decideGoal.isPending} onApprove={(cm) => decideGoal.mutate({ id: g.id, action: 'approve', comment: cm })} onReject={(cm) => decideGoal.mutate({ id: g.id, action: 'reject', comment: cm })} /> },
          ]} />
        </TabsContent>

        <TabsContent value="appraisals" className="mt-4">
          <DataTable stackOnMobile rows={appraisals.data} loading={appraisals.isLoading} error={appraisals.error} rowKey={(a) => a.id} emptyTitle="No appraisals to review" columns={[
            { key: 'e', header: 'Employee', cell: (a) => who(a.employee) },
            { key: 'c', header: 'Cycle', cell: (a) => a.appraisalCycle.name },
            { key: 's', header: 'Stage', cell: (a) => <StatusBadge status={a.status} /> },
            { key: 'a', header: '', align: 'right', cell: (a) => <Button size="sm" onClick={() => setAppraisalId(a.id)}>Review</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="resignations" className="mt-4">
          <DataTable stackOnMobile rows={pendingSeps} loading={seps.isLoading} error={seps.error} rowKey={(x) => x.id} emptyTitle="No resignations to decide" columns={[
            { key: 'e', header: 'Employee', cell: (x) => who(x.employee) },
            { key: 'r', header: 'Resigned on', cell: (x) => (x.resignationDate ? formatDate(x.resignationDate, false) : '-') },
            { key: 'l', header: 'Last working day', cell: (x) => (x.lastWorkingDate ? formatDate(x.lastWorkingDate, false) : '-') },
            { key: 'n', header: 'Notice', cell: (x) => `${x.noticePeriodDays} days`, align: 'right', hideOnMobile: true },
            { key: 'a', header: '', cell: (x) => <DecisionButtons subject={`${x.employee.firstName} ${x.employee.lastName}: resignation, last working day ${x.lastWorkingDate ? formatDate(x.lastWorkingDate, false) : 'to be agreed'}`} busy={decideSep.isPending} onApprove={(cm) => decideSep.mutate({ id: x.id, action: 'approve', comment: cm })} onReject={(cm) => decideSep.mutate({ id: x.id, action: 'reject', comment: cm })} /> },
          ]} />
        </TabsContent>
      </Tabs>
      <AppraisalModal id={appraisalId} onClose={() => setAppraisalId(undefined)} />
    </>
  );
}
