import * as React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { DayRecord, DayStatus } from '@/types/attendance';
import { Text } from '@/ui/kit';
import { Legend } from '@/ui/visual';
import { space, useTheme, type Theme } from '@/ui/theme';

const HEAD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The tint and ink for a day, so a month reads at a glance. */
export function dayColors(status: DayStatus, { colors }: Theme): { bg: string; fg: string } {
  switch (status) {
    case 'PRESENT': return { bg: colors.successSoft, fg: colors.success };
    case 'WORK_FROM_HOME': return { bg: colors.primarySoft, fg: colors.primary };
    case 'ON_LEAVE': return { bg: colors.leaveSoft, fg: colors.leave };
    case 'HALF_DAY': return { bg: colors.warningSoft, fg: colors.warning };
    case 'ABSENT': return { bg: colors.dangerSoft, fg: colors.danger };
    case 'HOLIDAY': return { bg: colors.holidaySoft, fg: colors.holiday };
    case 'NOT_MARKED': return { bg: colors.raised, fg: colors.textSecondary };
    default: return { bg: 'transparent', fg: colors.textTertiary };
  }
}

/** A month as a calendar of tinted days; tap a day to see its detail. */
export function MonthGrid({ days, selected, onSelect, today }: { days: DayRecord[]; selected: string | null; onSelect: (date: string) => void; today: string }) {
  const theme = useTheme();
  const { colors } = theme;
  if (!days.length) return null;
  const lead = days[0].weekday;
  const cells: (DayRecord | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.week}>{HEAD.map((h, i) => <Text key={i} variant="caption" tone="tertiary" style={styles.head}>{h}</Text>)}</View>
      {weeks.map((w, wi) => (
        <View key={wi} style={styles.week}>
          {w.map((d, i) => {
            if (!d) return <View key={i} style={[styles.cell, { borderColor: 'transparent' }]} />;
            const status = d.kind === 'WEEKLY_OFF' && d.status === 'NOT_MARKED' ? 'WEEKLY_OFF' : d.status;
            const c = dayColors(status, theme);
            const on = selected === d.date;
            const isToday = d.date.slice(0, 10) === today;
            const n = Number(d.date.slice(8, 10));
            return (
              <Pressable key={i} onPress={() => onSelect(d.date)} disabled={d.status === 'FUTURE'}
                accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${n}, ${status.toLowerCase().replace(/_/g, ' ')}`}
                android_ripple={Platform.OS === 'android' ? { color: colors.cardPressed, foreground: true } : undefined}
                style={[styles.cell, { backgroundColor: c.bg, borderColor: on ? colors.primary : 'transparent' }]}>
                <Text variant="caption" bold={isToday || (status !== 'WEEKLY_OFF' && status !== 'FUTURE')} num style={{ color: isToday && c.bg === 'transparent' ? colors.primary : c.fg }}>{n}</Text>
                {(d.lateEntry || isToday) && <View style={[styles.late, { backgroundColor: d.lateEntry ? colors.warning : colors.primary }]} />}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ marginTop: space.xs }}>
        <Legend items={[
          { color: colors.success, label: 'Present' }, { color: colors.primary, label: 'WFH' }, { color: colors.leave, label: 'Leave' },
          { color: colors.warning, label: 'Half day' }, { color: colors.danger, label: 'Absent' }, { color: colors.holiday, label: 'Holiday' },
        ]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', gap: 6 },
  head: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  late: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2 },
});
