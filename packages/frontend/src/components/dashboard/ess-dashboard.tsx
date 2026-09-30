'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PunchCard } from '@/components/attendance/punch-card';
import { QueryBoundary } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { QuickLinks } from '@/components/dashboard/quick-links';
import { AnnouncementsCard, CelebrationsCard, HolidaysCard, SectionCard } from '@/components/dashboard/widgets';
import { LeaveBalanceTable } from '@/components/leave/leave-balance-cards';
import { useEssDashboard } from '@/hooks/reports/use-reports';
import { formatDate, formatINR, monthLabel } from '@/lib/format';

interface Todo { key: string; text: string; href: string; meta?: string }

export function EssDashboard() {
  const q = useEssDashboard();
  return (
    <QueryBoundary query={q} rows={6}>
      {(d) => {
        const todos: Todo[] = [
          ...(d.pendingApprovals && d.pendingApprovals.total > 0 ? [{ key: 'appr', text: `${d.pendingApprovals.total} request(s) awaiting your approval`, href: '/approvals', meta: `Leave ${d.pendingApprovals.leave} · Attendance ${d.pendingApprovals.attendance} · Expenses ${d.pendingApprovals.expenses}` }] : []),
          ...d.pendingPolicies.map((p) => ({ key: `p${p.id}`, text: `Acknowledge “${p.title}”`, href: '/me/policies', meta: 'Policy' })),
          ...d.onboardingTasks.map((t) => ({ key: `o${t.id}`, text: t.title, href: '/me/profile', meta: t.dueDate ? `Onboarding · due ${formatDate(t.dueDate, false)}` : 'Onboarding' })),
        ];
        const s = d.attendanceSummary;
        return (
          <div className="space-y-4">
            <QuickLinks />
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="min-w-0 space-y-4 xl:col-span-2">
                <PunchCard />
                <SectionCard title="This month" flush action={<Link href="/me/attendance" className="text-fine font-semibold text-primary hover:underline">Attendance log</Link>}>
                  <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
                    {[
                      ['Present', s.present + s.wfh, ''], ['Half days', s.halfDay, ''], ['Absent', s.absent, s.absent ? 'text-destructive' : ''],
                      ['Late marks', s.lateMarks, s.lateMarks > 3 ? 'text-warning' : ''], ['Hours worked', s.workingHours, ''],
                    ].map(([l, v, c]) => <div key={l as string} className="bg-card px-6 py-3"><dt className="text-fine text-muted-foreground">{l}</dt><dd className={`mt-0.5 text-tagline font-semibold tabular-nums ${c}`}>{v}</dd></div>)}
                  </dl>
                </SectionCard>
                <SectionCard title="Leave balance" flush action={<Link href="/me/leave" className="text-fine font-semibold text-primary hover:underline">Apply leave</Link>}>
                  <LeaveBalanceTable balances={d.leaveBalances} />
                  {d.openLeaveRequests.length > 0 && (
                    <div className="border-t px-6 py-2.5 text-caption">
                      <p className="mb-1 text-fine font-semibold text-muted-foreground">Awaiting approval</p>
                      {d.openLeaveRequests.map((l) => <p key={l.id} className="flex items-center gap-2 py-0.5">{l.type} · {formatDate(l.from, false)} - {formatDate(l.to, false)} ({l.days}d) <StatusBadge status="OPEN" /></p>)}
                    </div>
                  )}
                </SectionCard>
                <SectionCard title="Payslips" flush action={<Link href="/me/payslips" className="text-fine font-semibold text-primary hover:underline">View all</Link>}>
                  {d.latestPayslips.length === 0 ? <p className="px-6 py-3 text-caption text-muted-foreground">No payslip published yet.</p> : (
                    <ul className="divide-y">{d.latestPayslips.map((p) => <li key={p.id}><Link href="/me/payslips" className="flex items-center justify-between px-6 py-2.5 text-caption hover:bg-accent/50"><span>{monthLabel(p.month, p.year)}</span><span className="flex items-center gap-3"><span className="font-semibold tabular-nums">{formatINR(p.net)}</span><Badge variant={p.status === 'PAID' ? 'success' : 'muted'}>{p.status === 'PAID' ? 'Paid' : 'Published'}</Badge></span></Link></li>)}</ul>
                  )}
                </SectionCard>
              </div>
              <div className="min-w-0 space-y-4">
                <SectionCard title="Pending actions" flush>
                  {todos.length === 0 ? <p className="px-6 py-3 text-caption text-muted-foreground">You&apos;re all caught up.</p> : (
                    <ul className="divide-y">{todos.map((t) => (
                      <li key={t.key}><Link href={t.href} className="flex items-center gap-2 px-6 py-2.5 hover:bg-accent/50"><span className="min-w-0 flex-1"><span className="block text-caption font-semibold">{t.text}</span>{t.meta && <span className="block text-fine text-muted-foreground">{t.meta}</span>}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link></li>
                    ))}</ul>
                  )}
                </SectionCard>
                <HolidaysCard items={d.upcomingHolidays} />
                <AnnouncementsCard items={d.announcements} />
                <CelebrationsCard data={d.celebrations} />
              </div>
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
