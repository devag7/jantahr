import * as React from 'react';
import Link from 'next/link';
import { Cake, PartyPopper, Pin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { Announcement } from '@/types/engagement';
import type { Celebrations } from '@/types/reports';

export function SectionCard({ title, action, children, className, flush }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>{title}</CardTitle>{action}</CardHeader>
      <CardContent className={cn(flush && 'p-0')}>{children}</CardContent>
    </Card>
  );
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function DateTile({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-sm border bg-card leading-none">
      <span className="text-micro font-semibold uppercase text-primary">{MON[d.getMonth()]}</span>
      <span className="mt-0.5 text-body font-semibold">{d.getDate()}</span>
    </span>
  );
}

export function AnnouncementsCard({ items }: { items: Announcement[] }) {
  return (
    <SectionCard title="Announcements" flush>
      {items.length === 0 ? <p className="px-6 py-3 text-caption text-muted-foreground">No announcements.</p> : (
        <ul className="divide-y">
          {items.map((a) => (
            <li key={a.id} className="px-6 py-3">
              <p className="flex items-center gap-1.5 text-caption-strong">{a.pinned && <Pin className="h-3.5 w-3.5 text-primary" aria-label="Pinned" />}{a.title}</p>
              <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">{a.body}</p>
              <p className="mt-1 text-fine text-muted-foreground">{formatDate(a.publishAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

const when = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`);

export function CelebrationsCard({ data }: { data: Celebrations }) {
  const rows = [
    ...data.birthdays.map((b) => ({ key: `b${b.id}`, icon: Cake, text: `${b.name}`, sub: 'Birthday', in: b.in })),
    ...data.anniversaries.map((a) => ({ key: `a${a.id}`, icon: PartyPopper, text: a.name, sub: `${a.years} year work anniversary`, in: a.in })),
  ].sort((a, b) => a.in - b.in).slice(0, 6);
  return (
    <SectionCard title="Birthdays & anniversaries" flush>
      {rows.length === 0 ? <p className="px-6 py-3 text-caption text-muted-foreground">Nothing coming up.</p> : (
        <ul className="divide-y">{rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 px-6 py-2 text-caption"><r.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.text}</span><span className="block text-fine text-muted-foreground">{r.sub}</span></span><span className="shrink-0 text-fine text-muted-foreground">{when(r.in)}</span></li>
        ))}</ul>
      )}
    </SectionCard>
  );
}

export function HolidaysCard({ items }: { items: { date: string; name: string }[] }) {
  return (
    <SectionCard title="Upcoming holidays" flush action={<Link href="/me/leave" className="text-fine font-semibold text-primary hover:underline">Holiday calendar</Link>}>
      {items.length === 0 ? <p className="px-6 py-3 text-caption text-muted-foreground">No upcoming holidays.</p> : (
        <ul className="divide-y">{items.map((h) => (
          <li key={h.date + h.name} className="flex items-center gap-3 px-6 py-2 text-caption"><DateTile iso={h.date} /><span className="flex-1"><span className="block font-semibold">{h.name}</span><span className="block text-fine text-muted-foreground">{new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long' })}</span></span></li>
        ))}</ul>
      )}
    </SectionCard>
  );
}
