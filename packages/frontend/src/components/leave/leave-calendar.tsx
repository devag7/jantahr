'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryBoundary } from '@/components/common/states';
import { useLeaveCalendar } from '@/hooks/leave/use-leave';
import { monthLabel } from '@/lib/format';
import { WEEKDAYS } from '@/lib/india';
import { cn } from '@/lib/utils';

/** Month grid of holidays plus leaves in the viewer's scope (self / team / company). */
export function LeaveCalendar() {
  const now = new Date();
  const [ym, setYm] = React.useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const q = useLeaveCalendar(ym.y, ym.m);
  const first = new Date(ym.y, ym.m - 1, 1);
  const days = new Date(ym.y, ym.m, 0).getDate();
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m - 1 + d, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 }; });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>{monthLabel(ym.m, ym.y)}</CardTitle>
        <div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button></div>
      </CardHeader>
      <CardContent>
        <QueryBoundary query={q}>
          {(d) => {
            const iso = (day: number) => `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return (
              <div>
                <div className="mb-1 grid grid-cols-7 gap-1 text-center text-fine font-semibold uppercase text-muted-foreground">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: first.getDay() }).map((_, i) => <div key={`o${i}`} />)}
                  {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const date = iso(day);
                    const wd = new Date(ym.y, ym.m - 1, day).getDay();
                    const holiday = d.holidays.find((h) => h.date === date);
                    const leaves = d.leaves.filter((l) => l.from <= date && l.to >= date);
                    return (
                      <div key={day} className={cn('min-h-16 rounded-md border p-1 text-fine', d.weeklyOffDays.includes(wd) && 'bg-muted/50', holiday && 'bg-warning/10')}>
                        <span className="text-fine text-muted-foreground">{day}</span>
                        {holiday && <p className="truncate text-micro font-semibold text-warning" title={holiday.name}>{holiday.name}</p>}
                        {leaves.slice(0, 2).map((l) => <p key={l.id} className={cn('truncate rounded-sm px-1 text-micro', l.status === 'OPEN' ? 'bg-warning/20' : 'bg-attendance-leave/20 text-attendance-leave')} title={`${l.employee}: ${l.leaveType} (${l.status.toLowerCase()})`}>{l.employee.split(' ')[0]}</p>)}
                        {leaves.length > 2 && <p className="text-micro text-muted-foreground">+{leaves.length - 2} more</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}
