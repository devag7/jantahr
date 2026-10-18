import * as React from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyState, ErrorState, LinkButton, Page, Row, Section, SkeletonCard, type IconName } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import type { AppNotification } from '@/types/engagement';

/** Web links in notifications that have a screen in the app. */
function screenFor(link: string | null): string | null {
  if (!link) return null;
  if (link.startsWith('/approvals')) return '/approvals';
  if (link.startsWith('/me/leave') || link.startsWith('/leave')) return '/leave';
  if (link.startsWith('/me/attendance') || link.startsWith('/attendance')) return '/attendance';
  if (link.startsWith('/me/payslips') || link.startsWith('/payroll/payslips')) return '/payslips';
  if (link.startsWith('/me/expenses') || link.startsWith('/expenses')) return '/expenses';
  if (link.startsWith('/me/policies') || link.startsWith('/policies')) return '/policies';
  return null;
}

/** An icon and colour per kind, read from where the notification points. */
function look(link: string | null, title: string, colors: ReturnType<typeof useTheme>['colors']): { icon: IconName; tone: string } {
  const to = screenFor(link);
  if (to === '/approvals') return { icon: 'checkmark-done', tone: colors.primary };
  if (to === '/leave') return { icon: 'calendar-outline', tone: colors.leave };
  if (to === '/attendance') return { icon: 'time-outline', tone: colors.success };
  if (to === '/payslips') return { icon: 'wallet-outline', tone: colors.success };
  if (to === '/expenses') return { icon: 'receipt-outline', tone: colors.warning };
  if (to === '/policies') return { icon: 'reader-outline', tone: colors.holiday };
  if (/perform|apprais|goal|review/i.test(`${link ?? ''} ${title}`)) return { icon: 'trending-up-outline', tone: colors.leave };
  if (/announce/i.test(`${link ?? ''} ${title}`)) return { icon: 'megaphone-outline', tone: colors.primary };
  return { icon: 'notifications-outline', tone: colors.textSecondary };
}

export default function Notifications() {
  const { colors } = useTheme();
  const q = useNotifications();
  const read = useMarkRead();
  const readAll = useMarkAllRead();
  const open = (n: AppNotification) => {
    if (!n.isRead) read.mutate(n);
    const to = screenFor(n.link);
    if (to) router.push(to as never);
  };
  const items = q.data?.items ?? [];
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ headerRight: () => (q.data?.unreadCount ? <LinkButton title="Mark all read" onPress={() => readAll.mutate(undefined)} /> : null) }} />
      {q.isLoading ? <SkeletonCard rows={5} /> : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No notifications" message="Approvals, decisions on your requests and payslips show up here." />
      ) : (
        [{ title: 'New', list: items.filter((n) => !n.isRead) }, { title: 'Earlier', list: items.filter((n) => n.isRead) }].filter((g) => g.list.length).map((g) => (
          <Section key={g.title} title={g.title}>
            <Card padded={false}>
              {g.list.map((n, i) => {
                const { icon, tone } = look(n.link, n.title, colors);
                return (
                  <Row key={n.id} icon={icon} iconTone={tone} title={n.title} subtitle={`${n.message}\n${formatDateTime(n.createdAt)}`} onPress={() => open(n)} chevron={!!screenFor(n.link)} last={i === g.list.length - 1}
                    right={!n.isRead ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} accessibilityLabel="Unread" /> : undefined} />
                );
              })}
            </Card>
          </Section>
        ))
      )}
    </Page>
  );
}
