import * as React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useCancelLeave, useLeaveBalance, useMyCompOff, useMyLeaves } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate, isoDate, plural } from '@/lib/format';
import { Button, Card, EmptyState, ErrorState, LinkButton, Page, Row, Section, SkeletonCard, StatusBadge, Text } from '@/ui/kit';
import { IconTile, ProgressRing } from '@/ui/visual';
import { leaveHue, space, useTheme } from '@/ui/theme';
import type { LeaveApplication } from '@/types/leave';

/** Balances first, then apply, then every request with its state (pending ones can be withdrawn). */
export default function Leave() {
  const { colors, dark } = useTheme();
  const balance = useLeaveBalance();
  const leaves = useMyLeaves();
  const comp = useMyCompOff();
  const cancel = useCancelLeave();
  const today = isoDate(new Date());

  const confirmCancel = (l: LeaveApplication) => Alert.alert('Cancel this leave?', `${l.leaveType.name}, ${formatDate(l.fromDate)}${l.toDate !== l.fromDate ? ` to ${formatDate(l.toDate)}` : ''}. The days go back to your balance.`, [
    { text: 'Keep it', style: 'cancel' }, { text: 'Cancel leave', style: 'destructive', onPress: () => cancel.mutate(l.id) },
  ]);

  return (
    <Page title="Leave" onRefresh={() => { void balance.refetch(); void leaves.refetch(); void comp.refetch(); }} refreshing={balance.isRefetching || leaves.isRefetching}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Apply for leave" icon="add" style={{ flex: 1 }} onPress={() => router.push('/apply-leave')} />
        <Button title="Holidays" kind="secondary" icon="sunny-outline" onPress={() => router.push('/holidays')} />
      </View>

      <Section title="Balance">
        {balance.isLoading ? <SkeletonCard rows={4} /> : balance.isError ? <ErrorState message={errorMessage(balance.error)} onRetry={() => void balance.refetch()} /> : (balance.data?.length ?? 0) === 0 ? (
          <EmptyState icon="calendar-outline" title="No leave policy yet" message="Your HR team has not assigned a leave policy to you." />
        ) : (
          <Card padded={false}>
            {balance.data!.map((b, i, a) => {
              const hue = leaveHue(b.leaveType, dark);
              const total = b.allocated + b.carryForwarded;
              return (
                <View key={b.leaveTypeId} style={[styles.balance, i < a.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                  {b.isLWP ? <IconTile icon="remove-circle-outline" color={colors.textTertiary} size={52} /> : (
                    <ProgressRing size={52} stroke={5} progress={total ? b.available / total : 0} color={b.available > 0 ? hue : colors.danger} track={colors.divider}>
                      <Text bold num style={{ fontSize: 16, color: b.available > 0 ? colors.text : colors.danger }}>{b.available % 1 === 0 ? b.available : b.available.toFixed(1)}</Text>
                    </ProgressRing>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text bold>{b.leaveType}</Text>
                    <Text variant="caption" tone="secondary">{b.isLWP ? 'Unpaid, no balance needed' : `${b.available % 1 === 0 ? b.available : b.available.toFixed(1)} of ${total} left · ${b.used} used${b.pending ? ` · ${b.pending} pending` : ''}`}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </Section>

      <Section title="Your requests">
        {leaves.isLoading ? <SkeletonCard rows={3} /> : leaves.isError ? <ErrorState message={errorMessage(leaves.error)} onRetry={() => void leaves.refetch()} /> : (leaves.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon="airplane-outline" title="No leave taken yet" message="Requests you make show here with their approval status." />
        ) : (
          <Card padded={false}>
            {leaves.data!.items.map((l, i, a) => {
              const cancellable = l.status === 'OPEN' || (l.status === 'APPROVED' && l.fromDate.slice(0, 10) > today);
              return (
                <Row key={l.id} icon="calendar-outline" iconTone={leaveHue(l.leaveType.name, dark)} title={`${l.leaveType.name} · ${plural(l.totalLeaveDays, 'day')}`}
                  subtitle={`${formatDate(l.fromDate)}${l.toDate !== l.fromDate ? ` to ${formatDate(l.toDate)}` : ''}${l.approverComment ? `\n“${l.approverComment}”` : ''}`}
                  right={<StatusBadge status={l.status} />} onPress={cancellable ? () => confirmCancel(l) : undefined} chevron={false}
                  accessibilityLabel={cancellable ? `${l.leaveType.name}, ${l.status}. Tap to cancel.` : undefined} last={i === a.length - 1} />
              );
            })}
          </Card>
        )}
        {(leaves.data?.items ?? []).some((l) => l.status === 'OPEN') && <Text variant="caption" tone="tertiary">Tap a pending request to withdraw it.</Text>}
      </Section>

      <Section title="Comp-off" action={<LinkButton title="Request" onPress={() => router.push('/comp-off')} />}>
        {(comp.data?.length ?? 0) === 0 ? (
          <Text variant="caption" tone="secondary">Worked on a holiday or weekly off? Request a comp-off and the day is added to your balance once approved.</Text>
        ) : (
          <Card padded={false}>
            {comp.data!.slice(0, 5).map((c, i, a) => (
              <Row key={c.id} title={`Worked ${formatDate(c.workFromDate)}${c.workEndDate !== c.workFromDate ? ` to ${formatDate(c.workEndDate)}` : ''}`} subtitle={c.reason} right={<StatusBadge status={c.status} />} last={i === a.length - 1} />
            ))}
          </Card>
        )}
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
});
