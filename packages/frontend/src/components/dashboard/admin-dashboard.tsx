'use client';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ClipboardList, FileWarning, LifeBuoy, TrendingDown, UserMinus, UserPlus, Users } from 'lucide-react';
import { DonutChart, GroupedBarChart, HBarChart } from '@/components/charts/charts';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { CelebrationsCard, SectionCard } from '@/components/dashboard/widgets';
import { useComplianceCalendar } from '@/hooks/compliance/use-compliance';
import { useAdminDashboard } from '@/hooks/reports/use-reports';
import { formatDate, formatINRCompact } from '@/lib/format';

export function AdminDashboard() {
  const router = useRouter();
  const q = useAdminDashboard();
  return (
    <QueryBoundary query={q} rows={6}>
      {(d) => {
        const a = d.attendanceToday;
        const pending = d.pending;
        const totalPending = pending.leave + pending.attendanceRequests + pending.expenses + pending.taxDeclarations + pending.separations;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Active employees" value={d.headcount.active} icon={Users} onClick={() => router.push('/hr/employees')} />
              <StatCard label="Joined this month" value={d.headcount.joinersThisMonth} icon={UserPlus} tone="success" />
              <StatCard label="Exits this FY" value={d.headcount.exitsThisFY} hint={`${d.headcount.attritionRatePercent}% attrition`} icon={UserMinus} tone={d.headcount.attritionRatePercent > 15 ? 'destructive' : 'default'} />
              <StatCard label="Open positions" value={d.recruitment.openPositions} hint={`${d.recruitment.activeApplicants} active applicants`} icon={TrendingDown} tone="info" onClick={() => router.push('/hr/recruitment')} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard title="Attendance today" flush className="lg:col-span-1" action={<button onClick={() => router.push('/hr/attendance')} className="text-fine font-semibold text-primary hover:underline">Details</button>}>
                <ul className="divide-y text-caption">
                  {[['Present / WFH', a.present, 'bg-success'], ['On leave', a.onLeave, 'bg-info'], ['Half day', a.halfDay, 'bg-warning'], ['Absent', a.absent, 'bg-destructive'], ['Not marked', a.notMarked, 'bg-muted-foreground']].map(([l, v, c]) => (
                    <li key={String(l)} className="flex items-center justify-between px-6 py-2"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${c}`} aria-hidden />{l}</span><span className="font-semibold tabular-nums">{v}</span></li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard title="Pending with HR" flush className="lg:col-span-1">
                {totalPending + pending.helpdesk + pending.overdueOnboarding === 0 ? <p className="px-6 py-3 text-caption text-muted-foreground">Nothing pending.</p> : (
                  <ul className="divide-y">
                    {[
                      ['Leave requests', pending.leave, '/hr/leave', ClipboardList], ['Attendance requests', pending.attendanceRequests, '/hr/attendance', CalendarCheck], ['Expense claims', pending.expenses, '/approvals', ClipboardList],
                      ['Tax declarations', pending.taxDeclarations, '/hr/payroll', FileWarning], ['Resignations', pending.separations, '/hr/lifecycle', UserMinus], ['Open helpdesk tickets', pending.helpdesk, '/me/helpdesk', LifeBuoy],
                      ['Overdue onboarding tasks', pending.overdueOnboarding, '/hr/lifecycle', FileWarning],
                    ].filter((x) => (x[1] as number) > 0).map(([label, count, href, Icon]) => {
                      const I = Icon as typeof ClipboardList;
                      return <li key={String(label)}><button onClick={() => router.push(String(href))} className="flex w-full items-center justify-between px-6 py-2 text-caption hover:bg-accent/50"><span className="flex items-center gap-2"><I className="h-4 w-4 text-muted-foreground" />{String(label)}</span><span className="min-w-6 rounded-full bg-muted px-2 text-center text-fine font-semibold text-warning">{String(count)}</span></button></li>;
                    })}
                  </ul>
                )}
              </SectionCard>
              <DeadlinesCard />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Payroll cost trend">
                {d.payrollTrend.length === 0 ? <p className="text-caption text-muted-foreground">No payroll processed yet.</p> : (
                  <GroupedBarChart data={d.payrollTrend} xKey="label" keys={[{ key: 'gross', label: 'Gross' }, { key: 'net', label: 'Net pay' }, { key: 'employerCost', label: 'Employer contributions' }]} formatValue={formatINRCompact} />
                )}
              </SectionCard>
              <SectionCard title="Headcount by department"><HBarChart data={d.byDepartment} /></SectionCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard title="Gender split"><DonutChart data={d.byGender} /></SectionCard>
              <SectionCard title="Employment type"><DonutChart data={d.byEmploymentType} /></SectionCard>
              <CelebrationsCard data={d.celebrations} />
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

/** Next statutory deadlines (compliance calendar), overdue first. */
function DeadlinesCard() {
  const router = useRouter();
  const q = useComplianceCalendar();
  const open = (q.data?.items ?? []).filter((i) => i.status !== 'DONE').slice(0, 6);
  return (
    <SectionCard title="Statutory deadlines" flush action={<button onClick={() => router.push('/hr/compliance')} className="text-fine font-semibold text-primary hover:underline">Calendar</button>}>
      {q.isLoading ? <p className="px-6 py-3 text-caption text-muted-foreground">Loading…</p> : open.length === 0 ? <p className="px-6 py-3 text-caption text-muted-foreground">No open deadlines in the next 60 days.</p> : (
        <ul className="divide-y">{open.map((i) => (
          <li key={i.key} className="flex items-center gap-3 px-6 py-2 text-caption">
            <span className={`w-14 shrink-0 text-fine font-semibold tabular-nums ${i.status === 'OVERDUE' ? 'text-destructive' : i.status === 'DUE_SOON' ? 'text-warning' : 'text-muted-foreground'}`}>{formatDate(i.dueDate, false).replace(/ \d{4}$/, '')}</span>
            <span className="min-w-0 flex-1 truncate">{i.title}</span>
          </li>
        ))}</ul>
      )}
    </SectionCard>
  );
}
