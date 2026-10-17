import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useManagerDashboard } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Badge, Card, EmptyState, ErrorState, Loading, Page, Row, Section, Text } from '@/ui/kit';
import { Avatar, AvatarStack, ProgressRing } from '@/ui/visual';
import { space, useTheme } from '@/ui/theme';

/** Who reports to you and who is in today, plus leave coming up. */
export default function Team() {
  const { colors } = useTheme();
  const q = useManagerDashboard(true);
  const d = q.data;
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? <Loading /> : q.isError || !d ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <>
          <Card style={styles.summary}>
            <ProgressRing size={96} stroke={9} progress={d.teamSize ? d.presentToday / d.teamSize : 0} color={colors.success} track={colors.divider}>
              <Text variant="heading" num>{d.presentToday}/{d.teamSize}</Text>
              <Text variant="caption" tone="tertiary">in today</Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: space.md }}>
              <View style={{ flexDirection: 'row', gap: space.lg }}>
                <Stat label="On leave" value={d.onLeaveToday} color={colors.leave} />
                <Stat label="Not in" value={Math.max(0, d.teamSize - d.presentToday - d.onLeaveToday)} />
              </View>
              {d.team.length > 0 && <AvatarStack names={d.team.map((m) => m.name)} size={30} max={5} ring={colors.card} />}
            </View>
          </Card>
          <Section title="Today">
            {d.team.length === 0 ? <EmptyState icon="people-outline" title="No one reports to you" /> : (
              <Card padded={false}>
                {d.team.map((m, i) => (
                  <View key={m.id} style={[styles.member, i < d.team.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                    <View>
                      <Avatar name={m.name} size={44} />
                      <View style={[styles.presence, { backgroundColor: m.presentToday ? colors.success : colors.textTertiary, borderColor: colors.card }]} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1}>{m.name}</Text>
                      <Text variant="caption" tone="secondary" numberOfLines={1}>{[m.designation, m.code].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Badge label={m.presentToday ? 'In' : 'Not in'} tone={m.presentToday ? 'success' : 'neutral'} />
                  </View>
                ))}
              </Card>
            )}
          </Section>
          {d.upcomingLeaves.length > 0 && (
            <Section title="Leave coming up">
              <Card padded={false}>
                {d.upcomingLeaves.map((l, i) => <Row key={`${l.employee}-${l.from}`} icon="airplane-outline" iconTone={colors.leave} title={l.employee} subtitle={`${l.type} · ${formatDate(l.from)}${l.to !== l.from ? ` to ${formatDate(l.to)}` : ''}`} last={i === d.upcomingLeaves.length - 1} />)}
              </Card>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return <View style={{ gap: 2 }}><Text variant="heading" num style={color ? { color } : undefined}>{value}</Text><Text variant="caption" tone="secondary">{label}</Text></View>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  presence: { position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
});
