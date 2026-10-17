import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useManagerDashboard } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Badge, Card, EmptyState, ErrorState, Loading, Page, Row, Section, Text } from '@/ui/kit';
import { useTheme } from '@/ui/theme';

/** Who reports to you and who is in today, plus leave coming up. */
export default function Team() {
  const { colors } = useTheme();
  const q = useManagerDashboard(true);
  const d = q.data;
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? <Loading /> : q.isError || !d ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <>
          <Card style={styles.stats}>
            <Stat label="Team" value={d.teamSize} />
            <Stat label="In today" value={d.presentToday} color={colors.success} />
            <Stat label="On leave" value={d.onLeaveToday} color={colors.primary} />
          </Card>
          <Section title="Today">
            {d.team.length === 0 ? <EmptyState icon="people-outline" title="No one reports to you" /> : (
              <Card padded={false}>
                {d.team.map((m, i) => (
                  <Row key={m.id} title={m.name} subtitle={[m.designation, m.code].filter(Boolean).join(' · ')} last={i === d.team.length - 1}
                    right={<Badge label={m.presentToday ? 'In' : 'Not in'} tone={m.presentToday ? 'success' : 'neutral'} />} />
                ))}
              </Card>
            )}
          </Section>
          {d.upcomingLeaves.length > 0 && (
            <Section title="Leave coming up">
              <Card padded={false}>
                {d.upcomingLeaves.map((l, i) => <Row key={`${l.employee}-${l.from}`} icon="airplane-outline" title={l.employee} subtitle={`${l.type} · ${formatDate(l.from)}${l.to !== l.from ? ` to ${formatDate(l.to)}` : ''}`} last={i === d.upcomingLeaves.length - 1} />)}
              </Card>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return <View style={{ flex: 1, alignItems: 'center', gap: 2 }}><Text variant="title" num style={color ? { color } : undefined}>{value}</Text><Text variant="caption" tone="secondary">{label}</Text></View>;
}

const styles = StyleSheet.create({ stats: { flexDirection: 'row' } });
