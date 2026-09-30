'use client';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/engagement/use-engagement';
import { useLiveNotifications } from '@/hooks/notifications/use-live-notifications';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const router = useRouter();
  const live = useLiveNotifications(true);
  const { data } = useNotifications(true, live);
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const unread = data?.unreadCount ?? 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-sm p-2 text-white/80 hover:text-white" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="h-[17px] w-[17px]" />
          {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-micro font-semibold text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-body font-semibold">Notifications</p>
          {unread > 0 && <button className="text-caption text-primary hover:underline" onClick={() => markAll.mutate()}>Mark all read</button>}
        </div>
        <ul className="max-h-96 divide-y overflow-y-auto">
          {(data?.items ?? []).length === 0 && <li className="px-4 py-8 text-center text-caption text-muted-foreground">You&apos;re all caught up</li>}
          {(data?.items ?? []).map((n) => (
            <li key={n.id}>
              <button className={cn('flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-muted/70', !n.isRead && 'bg-accent/40')}
                onClick={() => { if (!n.isRead) markOne.mutate(n.id); if (n.link) router.push(n.link); }}>
                <span className="text-caption font-semibold">{n.title}</span>
                <span className="line-clamp-2 text-caption text-muted-foreground">{n.message}</span>
                <span className="text-fine text-muted-foreground">{formatDateTime(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
