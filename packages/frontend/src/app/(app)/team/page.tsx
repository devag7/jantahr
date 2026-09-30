'use client';
import { CalendarOff, UserCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { UserAvatar } from '@/components/common/user-avatar';
import { CelebrationsCard, SectionCard } from '@/components/dashboard/widgets';
import { useManagerDashboard } from '@/hooks/reports/use-reports';
import { formatDate } from '@/lib/format';

export default function TeamPage() {
  const q = useManagerDashboard();
  return (
    <>
      <PageHeader title="Team overview" description="Who is in today and what needs your attention." />
      <QueryBoundary query={q} rows={5}>
        {(d) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Team size" value={d.teamSize} icon={Users} />
              <StatCard label="Present today" value={d.presentToday} icon={UserCheck} tone="success" />
              <StatCard label="On leave today" value={d.onLeaveToday} icon={CalendarOff} tone="info" />
              <StatCard label="Pending approvals" value={d.pending.leave + d.pending.attendanceRequests + d.pending.expenses} hint={`Leave ${d.pending.leave} · Attendance ${d.pending.attendanceRequests} · Expenses ${d.pending.expenses}`} tone="warning" />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <SectionCard title="My team" className="lg:col-span-2">
                <ul className="divide-y">{d.team.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5"><UserAvatar name={m.name} /><div className="min-w-0 flex-1"><p className="truncate text-caption font-semibold">{m.name}</p><p className="truncate text-fine text-muted-foreground">{m.designation ?? '-'} · {m.code}</p></div><StatusBadge status={m.presentToday ? 'PRESENT' : 'NOT_MARKED'} label={m.presentToday ? 'In' : 'Not in yet'} /></li>
                ))}</ul>
              </SectionCard>
              <div className="space-y-6">
                <SectionCard title="Leaves this week">{d.upcomingLeaves.length === 0 ? <p className="text-caption text-muted-foreground">No one is on leave.</p> : <ul className="space-y-2 text-caption">{d.upcomingLeaves.map((l, i) => <li key={i}><b>{l.employee}</b> · {l.type}<span className="block text-fine text-muted-foreground">{formatDate(l.from, false)} → {formatDate(l.to, false)}</span></li>)}</ul>}</SectionCard>
                <CelebrationsCard data={d.celebrations} />
              </div>
            </div>
          </div>
        )}
      </QueryBoundary>
    </>
  );
}
