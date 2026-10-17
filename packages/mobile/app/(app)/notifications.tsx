import * as React from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyState, ErrorState, Loading, Page, Row, Text } from '@/ui/kit';
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
      <Stack.Screen options={{ headerRight: () => (q.data?.unreadCount ? <Text tone="accent" onPress={() => readAll.mutate(undefined)} accessibilityRole="button">Mark all read</Text> : null) }} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No notifications" message="Approvals, decisions on your requests and payslips show up here." />
      ) : (
        <Card padded={false}>
          {items.map((n, i) => (
            <Row key={n.id} title={n.title} subtitle={`${n.message}\n${formatDateTime(n.createdAt)}`} onPress={() => open(n)} chevron={!!screenFor(n.link)} last={i === items.length - 1}
              right={!n.isRead ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} accessibilityLabel="Unread" /> : undefined} />
          ))}
        </Card>
      )}
    </Page>
  );
}
