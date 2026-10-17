import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text } from './kit';
import { space, useTheme } from './theme';
import { MONTH_NAMES, isoDate } from '@/lib/format';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A month grid for picking one date or a range (tap the first day, then the last). Dates are YYYY-MM-DD. Holidays
 * get a dot, so a leave range can be planned around them.
 */
export function CalendarPicker({ from, to, onChange, range = true, marked = [], minDate, maxDate }: {
  from: string | null; to: string | null; onChange: (from: string | null, to: string | null) => void; range?: boolean; marked?: string[]; minDate?: string; maxDate?: string;
}) {
  const { colors } = useTheme();
  const start = from ? new Date(`${from}T12:00:00`) : new Date();
  const [view, setView] = React.useState({ y: start.getFullYear(), m: start.getMonth() });
  const first = new Date(view.y, view.m, 1);
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => isoDate(new Date(view.y, view.m, i + 1)))];
  while (cells.length % 7) cells.push(null);
  const today = isoDate(new Date());
  const move = (n: number) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const pick = (d: string) => {
    if (!range) return onChange(d, d);
    if (!from || (from && to && from !== to) || d < from) return onChange(d, d);
    if (from === to && d > from) return onChange(from, d);
    onChange(d, d);
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => move(-1)} />
        <Text bold accessibilityRole="header">{MONTH_NAMES[view.m]} {view.y}</Text>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => move(1)} />
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => <View key={`w${i}`} style={styles.cell}><Text variant="caption" tone="tertiary">{w}</Text></View>)}
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const disabled = (minDate && d < minDate) || (maxDate && d > maxDate);
          const inRange = !!from && !!to && d >= from && d <= to;
          const edge = d === from || d === to;
          return (
            <Pressable key={d} disabled={!!disabled} onPress={() => pick(d)} style={styles.cell}
              accessibilityRole="button" accessibilityLabel={d} accessibilityState={{ selected: inRange, disabled: !!disabled }}>
              <View style={[styles.day, inRange && { backgroundColor: edge ? colors.primary : colors.primarySoft }, !inRange && d === today && { borderWidth: 1, borderColor: colors.primary }]}>
                <Text num bold={edge} style={{ color: edge ? colors.primaryText : disabled ? colors.textTertiary : colors.text, opacity: disabled ? 0.5 : 1 }}>{Number(d.slice(8))}</Text>
              </View>
              {marked.includes(d) && <View style={[styles.dot, { backgroundColor: colors.warning }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2 },
});
