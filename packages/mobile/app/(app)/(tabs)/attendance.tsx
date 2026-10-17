import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/auth';
import { PunchCard } from '@/features/punch-card';
import { useMonthLog, useMyAttendanceRequests } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { MONTH_NAMES, formatDate, formatTime } from '@/lib/format';
import { Button, Card, EmptyState, ErrorState, IconButton, Page, Row, Section, SkeletonCard, StatusBadge, Text } from '@/ui/kit';
import { space, useTheme } from '@/ui/theme';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REQUEST_LABEL = { REGULARIZE: 'Correction', ON_DUTY: 'On duty', WFH: 'Work from home' } as const;

/** Check in, then the month: totals, every day's in and out, and requests to correct a day. */
export default function Attendance() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const now = new Date();
  const [ym, setYm] = React.useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const log = useMonthLog(ym.y, ym.m);
  const requests = useMyAttendanceRequests();
  const move = (n: number) => setYm((v) => { const d = new Date(v.y, v.m - 1 + n, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; });
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1;
  const days = (log.data?.days ?? []).filter((d) => d.status !== 'FUTURE').slice().reverse();
  const sum = log.data?.summary;

  if (!user?.employee) return <Page title="Attendance"><EmptyState icon="person-outline" title="No employee profile" message="Your sign-in is not linked to an employee record, so there is no attendance to show." /></Page>;
  return (
    <Page title="Attendance" onRefresh={() => { void log.refetch(); void requests.refetch(); }} refreshing={log.isRefetching}>
      <PunchCard />
      <Button title="Correct a day, or request WFH / on duty" kind="secondary" icon="create-outline" onPress={() => router.push('/attendance-request')} />

      <Section>
        <View style={styles.month}>
          <IconButton icon="chevron-back" label="Previous month" onPress={() => move(-1)} />
          <Text bold accessibilityRole="header">{MONTH_NAMES[ym.m - 1]} {ym.y}</Text>
          <IconButton icon="chevron-forward" label="Next month" onPress={() => move(1)} tone={isCurrent ? colors.border : undefined} />
        </View>
        {sum && (
          <Card style={styles.summary}>
            <Total label="Present" value={sum.present + sum.wfh} />
            <Total label="Leave" value={sum.onLeave} />
            <Total label="Absent" value={sum.absent} tone={sum.absent ? colors.danger : undefined} />
            <Total label="Late" value={sum.lateMarks} tone={sum.lateMarks ? colors.warning : undefined} />
            <Total label="Hours" value={Math.round(sum.workingHours)} />
          </Card>
        )}
        {log.isLoading ? <SkeletonCard rows={6} /> : log.isError ? <ErrorState message={errorMessage(log.error)} onRetry={() => void log.refetch()} /> : days.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Nothing yet this month" />
        ) : (
          <Card padded={false}>
            {days.map((d, i) => (
              <Row key={d.date} title={`${WEEKDAY[d.weekday]}, ${formatDate(d.date, false)}`}
                subtitle={d.holidayName ?? (d.inTime ? `${formatTime(d.inTime)} to ${d.outTime ? formatTime(d.outTime) : '…'}${d.workingHours ? ` · ${d.workingHours.toFixed(1)} h` : ''}${d.lateEntry ? ' · late' : ''}` : null)}
                right={<StatusBadge status={d.kind === 'WEEKLY_OFF' && d.status === 'NOT_MARKED' ? 'WEEKLY_OFF' : d.status} />}
                last={i === days.length - 1} />
            ))}
          </Card>
        )}
      </Section>

      {(requests.data?.length ?? 0) > 0 && (
        <Section title="Your requests">
          <Card padded={false}>
            {requests.data!.slice(0, 10).map((r, i, a) => (
              <Row key={r.id} title={REQUEST_LABEL[r.requestType]} subtitle={`${formatDate(r.fromDate)}${r.toDate !== r.fromDate ? ` to ${formatDate(r.toDate)}` : ''} · ${r.reason}`}
                right={<StatusBadge status={r.status} />} last={i === a.length - 1} />
            ))}
          </Card>
        </Section>
      )}
    </Page>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="heading" num style={tone ? { color: tone } : undefined}>{value}</Text>
      <Text variant="caption" tone="secondary">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { flexDirection: 'row', paddingHorizontal: space.sm },
});
