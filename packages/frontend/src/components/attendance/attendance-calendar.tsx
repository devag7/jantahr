'use client';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/format';
import { WEEKDAYS } from '@/lib/india';
import type { DayRecord, DayStatus } from '@/types/attendance';

const CELL: Record<DayStatus, string> = {
  PRESENT: 'bg-attendance-present/15 text-attendance-present', WORK_FROM_HOME: 'bg-info/15 text-info', ABSENT: 'bg-attendance-absent/15 text-attendance-absent',
  HALF_DAY: 'bg-attendance-half/15 text-attendance-half', ON_LEAVE: 'bg-attendance-leave/15 text-attendance-leave', HOLIDAY: 'bg-muted text-muted-foreground',
  WEEKLY_OFF: 'bg-muted/60 text-muted-foreground', NOT_MARKED: 'border border-dashed text-muted-foreground', FUTURE: 'text-muted-foreground/60',
};
const LABEL: Record<DayStatus, string> = { PRESENT: 'P', WORK_FROM_HOME: 'WFH', ABSENT: 'A', HALF_DAY: '½', ON_LEAVE: 'L', HOLIDAY: 'H', WEEKLY_OFF: 'Off', NOT_MARKED: '?', FUTURE: '' };

export const ATTENDANCE_LEGEND: { status: DayStatus; label: string }[] = [
  { status: 'PRESENT', label: 'Present' }, { status: 'WORK_FROM_HOME', label: 'WFH' }, { status: 'HALF_DAY', label: 'Half day' }, { status: 'ABSENT', label: 'Absent' },
  { status: 'ON_LEAVE', label: 'Leave' }, { status: 'HOLIDAY', label: 'Holiday' }, { status: 'NOT_MARKED', label: 'Not marked' },
];

export function AttendanceCalendar({ days, onSelect, selected }: { days: DayRecord[]; onSelect?: (d: DayRecord) => void; selected?: string }) {
  const offset = days.length ? days[0].weekday : 0;
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-fine font-semibold uppercase text-muted-foreground">{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`o${i}`} />)}
        {days.map((d) => (
          <button key={d.date} type="button" onClick={() => onSelect?.(d)} aria-label={`${d.date}: ${d.status.replace('_', ' ').toLowerCase()}`}
            title={[d.holidayName, d.inTime && `In ${formatTime(d.inTime)}`, d.outTime && `Out ${formatTime(d.outTime)}`, d.lateEntry && 'Late'].filter(Boolean).join(' · ') || undefined}
            className={cn('flex aspect-square min-h-11 flex-col items-center justify-center rounded-md p-1 text-fine transition-colors hover:ring-2 hover:ring-ring', CELL[d.status], selected === d.date && 'ring-2 ring-primary')}>
            <span className="text-fine opacity-70">{Number(d.date.slice(8))}</span>
            <span className="font-semibold leading-none">{LABEL[d.status]}</span>
            {d.lateEntry && <span className="mt-0.5 h-1 w-1 rounded-full bg-warning" aria-hidden />}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-fine text-muted-foreground">
        {ATTENDANCE_LEGEND.map((l) => <span key={l.status} className="flex items-center gap-1.5"><span className={cn('inline-block h-3 w-3 rounded-sm', CELL[l.status])} aria-hidden />{l.label}</span>)}
      </div>
    </div>
  );
}
