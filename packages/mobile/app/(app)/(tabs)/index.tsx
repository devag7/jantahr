import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isApprover, useAuth } from '@/auth/auth';
import { PunchCard } from '@/features/punch-card';
import { useEss } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate, formatINR, formatPayMonth, plural } from '@/lib/format';
import { Card, ErrorState, Loading, Page, Row, Section, Text } from '@/ui/kit';
import { radius, space, useTheme } from '@/ui/theme';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** Today at a glance: check in, what needs you, what you have left, what was paid. */
export default function Home() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const ess = useEss();
  const d = ess.data;
  const approvals = isApprover(user) ? d?.pendingApprovals?.total ?? 0 : 0;
  const slip = d?.latestPayslips[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Page onRefresh={() => void ess.refetch()} refreshing={ess.isRefetching}>
      <View style={{ gap: space.xs }}>
        <Text variant="caption" tone="secondary">{today}</Text>
        <Text variant="title">{greeting()}, {user?.employee?.firstName ?? 'there'}</Text>
      </View>

      {user?.employee && <PunchCard />}

      {ess.isLoading ? <Loading /> : ess.isError ? <ErrorState message={errorMessage(ess.error)} onRetry={() => void ess.refetch()} /> : d && (
        <>
          {approvals > 0 && (
            <Pressable onPress={() => router.push('/approvals')} accessibilityRole="button"
              style={({ pressed }) => [styles.banner, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
              <Ionicons name="checkmark-done-circle" size={28} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Text bold tone="inverse">{plural(approvals, 'request')} waiting for you</Text>
                <Text variant="caption" tone="inverse" style={{ opacity: 0.85 }}>
                  {[d.pendingApprovals?.leave && `${d.pendingApprovals.leave} leave`, d.pendingApprovals?.attendance && `${d.pendingApprovals.attendance} attendance`, d.pendingApprovals?.expenses && `${d.pendingApprovals.expenses} expenses`].filter(Boolean).join(' · ') || 'Tap to review'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primaryText} />
            </Pressable>
          )}

          {d.leaveBalances.length > 0 && (
            <Section title="Leave balance" action={<Text variant="caption" tone="accent" onPress={() => router.push('/apply-leave')}>Apply</Text>}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                {d.leaveBalances.filter((b) => !b.isLWP).map((b) => (
                  <Card key={b.leaveTypeId} style={styles.balance}>
                    <Text variant="title" num>{b.available % 1 === 0 ? b.available : b.available.toFixed(1)}</Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>{b.leaveType}</Text>
                    {b.pending > 0 && <Text variant="caption" tone="warning">{b.pending} pending</Text>}
                  </Card>
                ))}
              </ScrollView>
            </Section>
          )}

          {slip && (
            <Section title="Latest payslip">
              <Card padded={false}>
                <Row icon="wallet-outline" title={formatPayMonth(slip.month, slip.year)} subtitle="Net pay" value={formatINR(slip.net)} onPress={() => router.push(`/payslip/${slip.id}`)} last />
              </Card>
            </Section>
          )}

          {d.openLeaveRequests.length > 0 && (
            <Section title="Your open leave requests">
              <Card padded={false}>
                {d.openLeaveRequests.map((l, i) => (
                  <Row key={l.id} icon="hourglass-outline" iconTone={colors.warning} title={l.type} subtitle={`${formatDate(l.from)}${l.to !== l.from ? ` to ${formatDate(l.to)}` : ''}`} value={plural(l.days, 'day')} last={i === d.openLeaveRequests.length - 1} onPress={() => router.push('/leave')} />
                ))}
              </Card>
            </Section>
          )}

          {d.pendingPolicies.length > 0 && (
            <Section title="To read">
              <Card padded={false}>
                {d.pendingPolicies.map((p, i) => <Row key={p.id} icon="document-text-outline" title={p.title} subtitle="Read and acknowledge" last={i === d.pendingPolicies.length - 1} onPress={() => router.push('/policies')} />)}
              </Card>
            </Section>
          )}

          {d.upcomingHolidays.length > 0 && (
            <Section title="Coming holidays" action={<Text variant="caption" tone="accent" onPress={() => router.push('/holidays')}>All</Text>}>
              <Card padded={false}>
                {d.upcomingHolidays.slice(0, 3).map((h, i, a) => <Row key={h.date} icon="sunny-outline" iconTone={colors.warning} title={h.name} value={formatDate(h.date, false)} last={i === a.length - 1} />)}
              </Card>
            </Section>
          )}

          {d.announcements.length > 0 && (
            <Section title="Announcements">
              {d.announcements.slice(0, 3).map((a) => (
                <Card key={a.id} style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    {a.pinned && <Ionicons name="pin" size={14} color={colors.primary} />}
                    <Text bold style={{ flex: 1 }}>{a.title}</Text>
                  </View>
                  <Text tone="secondary" numberOfLines={4}>{a.body}</Text>
                  <Text variant="caption" tone="tertiary">{formatDate(a.publishAt)}</Text>
                </Card>
              ))}
            </Section>
          )}

          {(d.celebrations.birthdays.length > 0 || d.celebrations.anniversaries.length > 0) && (
            <Section title="Celebrations">
              <Card padded={false}>
                {[...d.celebrations.birthdays.map((c) => ({ ...c, kind: 'birthday' })), ...d.celebrations.anniversaries.map((c) => ({ ...c, kind: 'work' }))].slice(0, 5).map((c, i, a) => (
                  <Row key={`${c.kind}-${c.id}`} icon={c.kind === 'birthday' ? 'gift-outline' : 'ribbon-outline'} iconTone={colors.success} title={c.name}
                    subtitle={c.kind === 'birthday' ? 'Birthday' : `${plural(c.years ?? 1, 'year')} at work`} value={c.in === 0 ? 'Today' : c.in === 1 ? 'Tomorrow' : `In ${c.in} days`} last={i === a.length - 1} />
                ))}
              </Card>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  balance: { width: 132, gap: space.xs },
});
