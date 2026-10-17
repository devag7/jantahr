import * as React from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { isApprover, useAuth } from '@/auth/auth';
import { PunchCard } from '@/features/punch-card';
import { useEss, useHasFeature, useNotifications } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { MONTH_SHORT, formatDate, formatINR, formatPayMonth, plural } from '@/lib/format';
import { Card, ErrorState, IconButton, LinkButton, Row, Section, Skeleton, SkeletonCard, Text } from '@/ui/kit';
import { Avatar, IconTile, MiniBars, ProgressRing, QuickAction } from '@/ui/visual';
import { leaveHue, radius, space, useTheme } from '@/ui/theme';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** Today at a glance: check in on the brand header, then what needs you, what you have left and what was paid. */
export default function Home() {
  const { user } = useAuth();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const ess = useEss();
  const notes = useNotifications();
  const hasExpenses = useHasFeature('expenses');
  const d = ess.data;
  const approvals = isApprover(user) ? d?.pendingApprovals?.total ?? 0 : 0;
  const name = user?.employee?.fullName ?? user?.email ?? '';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const slips = (d?.latestPayslips ?? []).slice().sort((a, b) => a.year - b.year || a.month - b.month);
  const latest = slips[slips.length - 1];
  // light icons over the cobalt header while Home is showing
  useFocusEffect(React.useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle(dark ? 'light' : 'dark');
  }, [dark]));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={ess.isRefetching} onRefresh={() => { void ess.refetch(); void notes.refetch(); }} tintColor={colors.onBrand} colors={[colors.primary]} progressViewOffset={insets.top} />}
    >
      {/* the brand moment: greeting and check-in on cobalt */}
      <View style={[styles.hero, { backgroundColor: colors.brand, paddingTop: insets.top + space.lg }]}>
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Profile" hitSlop={8}>
            <Avatar name={name} size={44} style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={{ color: colors.onBrandMuted }}>{today}</Text>
            <Text variant="heading" style={{ color: colors.onBrand }} numberOfLines={1}>{greeting()}, {user?.employee?.firstName ?? 'there'}</Text>
          </View>
          <IconButton icon="notifications-outline" label="Notifications" tone={colors.onBrand} badge={notes.data?.unreadCount} onPress={() => router.push('/notifications')} />
        </View>
        {user?.employee && <PunchCard hero />}
      </View>

      <View style={styles.body}>
        <View style={styles.quickRow}>
          <QuickAction icon="calendar-outline" label="Apply leave" color={dark ? '#7C97FF' : '#2350E8'} onPress={() => router.push('/apply-leave')} />
          <QuickAction icon="create-outline" label="Fix a day" color={dark ? '#A78BFA' : '#7048E8'} onPress={() => router.push('/attendance-request')} />
          <QuickAction icon="wallet-outline" label="Payslips" color={dark ? '#3DD598' : '#12805C'} onPress={() => router.push('/payslips')} />
          {hasExpenses
            ? <QuickAction icon="receipt-outline" label="Expenses" color={dark ? '#F5A524' : '#B45309'} onPress={() => router.push('/expenses')} />
            : <QuickAction icon="sunny-outline" label="Holidays" color={dark ? '#F5A524' : '#B45309'} onPress={() => router.push('/holidays')} />}
        </View>

        {ess.isLoading ? <HomeSkeleton /> : ess.isError ? <ErrorState message={errorMessage(ess.error)} onRetry={() => void ess.refetch()} /> : d && (
          <>
            {approvals > 0 && (
              <Card padded={false}>
                <Pressable onPress={() => router.push('/approvals')} accessibilityRole="button" android_ripple={Platform.OS === 'android' ? { color: colors.cardPressed, foreground: true } : undefined} style={styles.banner}>
                  <IconTile icon="checkmark-done" color={colors.primary} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text bold>{plural(approvals, 'request')} waiting for you</Text>
                    <Text variant="caption" tone="secondary">
                      {[d.pendingApprovals?.leave && `${d.pendingApprovals.leave} leave`, d.pendingApprovals?.attendance && `${d.pendingApprovals.attendance} attendance`, d.pendingApprovals?.expenses && `${d.pendingApprovals.expenses} expenses`].filter(Boolean).join(' · ') || 'Review and decide'}
                    </Text>
                  </View>
                  <View style={[styles.count, { backgroundColor: colors.primary }]}><Text variant="caption" bold style={{ color: colors.primaryText }}>{approvals}</Text></View>
                </Pressable>
              </Card>
            )}

            {d.leaveBalances.length > 0 && (
              <Section title="Leave left" action={<LinkButton title="Apply" onPress={() => router.push('/apply-leave')} />}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }} style={{ marginHorizontal: -space.lg }} contentInset={{ left: space.lg }}>
                  <View style={{ width: space.lg - space.md }} />
                  {d.leaveBalances.filter((b) => !b.isLWP).map((b) => {
                    const hue = leaveHue(b.leaveType, dark);
                    const total = b.allocated + b.carryForwarded;
                    return (
                      <Card key={b.leaveTypeId} style={styles.balance}>
                        <ProgressRing size={64} stroke={6} progress={total ? b.available / total : 0} color={hue} track={colors.divider}>
                          <Text bold num style={{ fontSize: 18 }}>{b.available % 1 === 0 ? b.available : b.available.toFixed(1)}</Text>
                        </ProgressRing>
                        <View style={{ gap: 2 }}>
                          <Text variant="caption" bold numberOfLines={1}>{b.leaveType.replace(/ Leave$/, '')}</Text>
                          <Text variant="caption" tone="tertiary">{b.pending ? `${b.pending} pending` : `of ${total} days`}</Text>
                        </View>
                      </Card>
                    );
                  })}
                  <View style={{ width: space.lg - space.md }} />
                </ScrollView>
              </Section>
            )}

            {latest && (
              <Section title="Pay">
                <Card padded={false}>
                  <Pressable onPress={() => router.push(`/payslip/${latest.id}`)} accessibilityRole="button" android_ripple={Platform.OS === 'android' ? { color: colors.cardPressed, foreground: true } : undefined} style={styles.pay}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="caption" tone="secondary">{formatPayMonth(latest.month, latest.year)} take-home</Text>
                      <Text variant="title" num>{formatINR(latest.net)}</Text>
                      <Text variant="caption" tone="accent" bold>View payslip</Text>
                    </View>
                    {slips.length > 1 && (
                      <View style={{ width: 132 }}>
                        <MiniBars values={slips.map((x) => x.net)} labels={slips.map((x) => MONTH_SHORT[x.month - 1])} color={colors.primary} muted={colors.primarySoft} height={56} />
                      </View>
                    )}
                  </Pressable>
                </Card>
              </Section>
            )}

            {d.openLeaveRequests.length > 0 && (
              <Section title="Waiting for approval">
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
              <Section title="Coming up" action={<LinkButton title="All holidays" onPress={() => router.push('/holidays')} />}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                  {d.upcomingHolidays.slice(0, 6).map((h) => {
                    const date = new Date(h.date);
                    return (
                      <Card key={h.date} style={styles.holiday}>
                        <View style={[styles.dateChip, { backgroundColor: colors.warningSoft }]}>
                          <Text variant="caption" bold style={{ color: colors.warning, fontSize: 11 }}>{MONTH_SHORT[date.getUTCMonth()].toUpperCase()}</Text>
                          <Text variant="heading" num style={{ color: colors.warning }}>{date.getUTCDate()}</Text>
                        </View>
                        <Text variant="caption" bold numberOfLines={2}>{h.name}</Text>
                      </Card>
                    );
                  })}
                </ScrollView>
              </Section>
            )}

            {d.announcements.length > 0 && (
              <Section title="From your company">
                {d.announcements.slice(0, 3).map((a) => (
                  <Card key={a.id} style={{ gap: space.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      {a.pinned && <Ionicons name="pin" size={14} color={colors.primary} />}
                      <Text bold style={{ flex: 1 }}>{a.title}</Text>
                      <Text variant="caption" tone="tertiary">{formatDate(a.publishAt, false)}</Text>
                    </View>
                    <Text tone="secondary" numberOfLines={4}>{a.body}</Text>
                  </Card>
                ))}
              </Section>
            )}

            {(d.celebrations.birthdays.length > 0 || d.celebrations.anniversaries.length > 0) && (
              <Section title="Celebrations">
                <Card padded={false}>
                  {[...d.celebrations.birthdays.map((c) => ({ ...c, kind: 'birthday' as const })), ...d.celebrations.anniversaries.map((c) => ({ ...c, kind: 'work' as const }))].slice(0, 5).map((c, i, a) => (
                    <View key={`${c.kind}-${c.id}`} style={[styles.celebration, i < a.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                      <Avatar name={c.name} size={40} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text numberOfLines={1}>{c.name}</Text>
                        <Text variant="caption" tone="secondary">{c.kind === 'birthday' ? 'Birthday' : `${plural(c.years ?? 1, 'year')} at work`}</Text>
                      </View>
                      <Text variant="caption" bold tone={c.in === 0 ? 'accent' : 'tertiary'}>{c.in === 0 ? 'Today' : c.in === 1 ? 'Tomorrow' : `In ${c.in} days`}</Text>
                      <Ionicons name={c.kind === 'birthday' ? 'gift-outline' : 'ribbon-outline'} size={18} color={colors.success} />
                    </View>
                  ))}
                </Card>
              </Section>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ flexDirection: 'row', gap: space.md }}>{[0, 1, 2].map((i) => <Card key={i} style={styles.balance}><Skeleton height={64} width={64} style={{ borderRadius: 32 }} /><Skeleton height={12} width="70%" /></Card>)}</View>
      <SkeletonCard rows={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  body: { padding: space.lg, gap: space.xl },
  quickRow: { flexDirection: 'row', gap: space.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  count: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center' },
  balance: { width: 116, gap: space.md, alignItems: 'flex-start' },
  pay: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  holiday: { width: 128, gap: space.sm },
  dateChip: { width: 52, borderRadius: radius.md, alignItems: 'center', paddingVertical: space.xs },
  celebration: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
