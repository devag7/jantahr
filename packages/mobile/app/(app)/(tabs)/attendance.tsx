import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/auth';
import { MonthGrid } from '@/features/month-grid';
import { PunchCard } from '@/features/punch-card';
import { useMonthLog, useMyAttendanceRequests } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { MONTH_NAMES, formatDate, formatTime } from '@/lib/format';
import { Button, Card, Divider, EmptyState, ErrorState, IconButton, Page, Row, Section, SkeletonCard, StatusBadge, Text } from '@/ui/kit';
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
  const all = log.data?.days ?? [];
  const sum = log.data?.summary;
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [picked, setPicked] = React.useState<string | null>(null);
  // the day in focus: the one tapped, else today, else the month's last day so far
  const day = all.find((d) => d.date === picked) ?? all.find((d) => d.date.slice(0, 10) === today) ?? all.filter((d) => d.status !== 'FUTURE').at(-1);

  if (!user?.employee) return <Page title="Attendance"><EmptyState icon="person-outline" title="No employee profile" message="Your sign-in is not linked to an employee record, so there is no attendance to show." /></Page>;
  return (
    <Page title="Attendance" onRefresh={() => { void log.refetch(); void requests.refetch(); }} refreshing={log.isRefetching}>
      <PunchCard />

      <Card style={{ gap: space.lg }}>
        <View style={styles.month}>
          <IconButton icon="chevron-back" label="Previous month" onPress={() => { setPicked(null); move(-1); }} />
          <Text variant="heading" accessibilityRole="header">{MONTH_NAMES[ym.m - 1]} {ym.y}</Text>
          <IconButton icon="chevron-forward" label="Next month" onPress={() => { setPicked(null); move(1); }} tone={isCurrent ? colors.border : undefined} />
        </View>
        {sum && (
          <View style={styles.summary}>
            <Total label="Present" value={sum.present + sum.wfh} tone={colors.success} />
            <Total label="Leave" value={sum.onLeave} tone={colors.leave} />
            <Total label="Absent" value={sum.absent} tone={sum.absent ? colors.danger : undefined} />
            <Total label="Late" value={sum.lateMarks} tone={sum.lateMarks ? colors.warning : undefined} />
            <Total label="Hours" value={Math.round(sum.workingHours)} />
          </View>
        )}
        <Divider />
        {log.isLoading ? <SkeletonCard rows={5} /> : log.isError ? <ErrorState message={errorMessage(log.error)} onRetry={() => void log.refetch()} /> : all.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Nothing yet this month" />
        ) : (
          <MonthGrid days={all} selected={day?.date ?? null} onSelect={setPicked} today={today} />
        )}
      </Card>

      {day && day.status !== 'FUTURE' && (
        <Card style={{ gap: space.md }}>
          <View style={styles.dayHead}>
            <Text bold style={{ flex: 1 }}>{WEEKDAY[day.weekday]}, {formatDate(day.date, false)}</Text>
            <StatusBadge status={day.kind === 'WEEKLY_OFF' && day.status === 'NOT_MARKED' ? 'WEEKLY_OFF' : day.status} />
          </View>
          {day.holidayName ? <Text tone="secondary">{day.holidayName}</Text> : day.inTime ? (
            <View style={styles.times}>
              <Stamp label="In" value={formatTime(day.inTime)} note={day.lateEntry ? 'Late' : undefined} />
              <Stamp label="Out" value={day.outTime ? formatTime(day.outTime) : '…'} note={day.earlyExit ? 'Early' : undefined} />
              <Stamp label="Worked" value={day.workingHours ? `${day.workingHours.toFixed(1)} h` : '…'} />
            </View>
          ) : <Text tone="secondary">No check-in recorded.</Text>}
          {day.status !== 'PRESENT' && day.status !== 'HOLIDAY' && day.kind === 'WORKING' && (
            <Button title="Correct this day" kind="secondary" icon="create-outline" compact onPress={() => router.push({ pathname: '/attendance-request', params: { date: day.date.slice(0, 10) } })} />
          )}
        </Card>
      )}

      <Button title="Request a correction, WFH or on duty" kind="ghost" icon="add-circle-outline" onPress={() => router.push('/attendance-request')} />

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

function Stamp({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" tone="tertiary">{label}</Text>
      <Text bold num>{value}</Text>
      {note && <Text variant="caption" tone="warning">{note}</Text>}
    </View>
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
  month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -space.sm, marginTop: -space.sm },
  summary: { flexDirection: 'row' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  times: { flexDirection: 'row', gap: space.md },
});
