'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight, FilePenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttendanceCalendar } from '@/components/attendance/attendance-calendar';
import { AttendanceRequestModal } from '@/components/attendance/request-form';
import { PunchCard } from '@/components/attendance/punch-card';
import { DataTable } from '@/components/common/data-table';
import { DetailList } from '@/components/common/detail-list';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { useAttendanceRequests, useMonthLog } from '@/hooks/attendance/use-attendance';
import { formatDate, formatTime, monthLabel } from '@/lib/format';
import type { DayRecord } from '@/types/attendance';

export default function MyAttendancePage() {
  const now = new Date();
  const [ym, setYm] = React.useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [picked, setPicked] = React.useState<DayRecord | null>(null);
  const [reqOpen, setReqOpen] = React.useState(false);
  const log = useMonthLog(ym.y, ym.m);
  const requests = useAttendanceRequests();
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m - 1 + d, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 }; });

  return (
    <>
      <PageHeader title="My attendance" description="Check in, review your month, and request corrections." actions={<Button onClick={() => { setPicked(null); setReqOpen(true); }}><FilePenLine className="mr-2 h-4 w-4" />Attendance request</Button>} />
      <div className="space-y-6">
        <PunchCard />
        <QueryBoundary query={log} rows={6}>
          {(d) => (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard label="Present" value={d.summary.present + d.summary.wfh} tone="success" />
                <StatCard label="Half days" value={d.summary.halfDay} tone={d.summary.halfDay ? 'warning' : 'default'} />
                <StatCard label="Absent" value={d.summary.absent} tone="destructive" />
                <StatCard label="Late marks" value={d.summary.lateMarks} tone={d.summary.lateMarks > 3 ? 'warning' : 'default'} />
                <StatCard label="Hours / overtime" value={`${d.summary.workingHours} / ${d.summary.overtimeHours}`} />
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>{monthLabel(ym.m, ym.y)}</CardTitle>
                    <div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button></div>
                  </CardHeader>
                  <CardContent><AttendanceCalendar days={d.days} selected={picked?.date} onSelect={setPicked} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>{picked ? formatDate(picked.date) : 'Select a day'}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {picked ? (
                      <>
                        <StatusBadge status={picked.status} />
                        <DetailList cols={1} items={[
                          { label: 'Check in', value: formatTime(picked.inTime) }, { label: 'Check out', value: formatTime(picked.outTime) }, { label: 'Hours', value: picked.workingHours ?? '-' },
                          { label: 'Shift', value: picked.shift ?? '-' }, { label: 'Overtime', value: picked.overtime ? `${picked.overtime} hrs` : '-' }, { label: 'Notes', value: picked.holidayName ?? picked.remarks ?? '-' },
                        ]} />
                        {picked.kind === 'WORKING' && picked.status !== 'FUTURE' && <Button variant="outline" size="sm" onClick={() => setReqOpen(true)}>Request correction</Button>}
                      </>
                    ) : <p className="text-caption text-muted-foreground">Tap a date on the calendar to see punch times and request corrections.</p>}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </QueryBoundary>
        <div>
          <h2 className="mb-3 text-body font-semibold">My requests</h2>
          <DataTable rows={requests.data} loading={requests.isLoading} error={requests.error} rowKey={(r) => r.id} emptyTitle="No attendance requests" columns={[
            { key: 'd', header: 'Dates', cell: (r) => `${formatDate(r.fromDate, false)}${r.toDate !== r.fromDate ? ` → ${formatDate(r.toDate, false)}` : ''}` },
            { key: 't', header: 'Type', cell: (r) => r.requestType.replace('_', ' ').toLowerCase() },
            { key: 'r', header: 'Reason', cell: (r) => <span className="line-clamp-1">{r.reason}</span>, hideOnMobile: true },
            { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          ]} />
        </div>
      </div>
      <AttendanceRequestModal open={reqOpen} onOpenChange={setReqOpen} defaultDate={picked?.date} />
    </>
  );
}
