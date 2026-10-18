import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useHolidays } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { MONTH_SHORT, isoDate, plural } from '@/lib/format';
import { Badge, Card, EmptyState, ErrorState, Loading, Page, Segmented, Text } from '@/ui/kit';
import { radius, space, useTheme } from '@/ui/theme';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The company's holiday list for the year as date tiles; the next one is called out, past ones fade. */
export default function Holidays() {
  const { colors } = useTheme();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const q = useHolidays(year);
  const today = isoDate(new Date());
  const list = q.data ?? [];
  const next = list.find((h) => h.date.slice(0, 10) >= today);
  const daysTo = (d: string) => Math.round((Date.parse(d.slice(0, 10)) - Date.parse(today)) / 86_400_000);
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Segmented value={String(year)} onChange={(y) => setYear(Number(y))} options={[thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y) }))} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : list.length === 0 ? (
        <EmptyState icon="sunny-outline" title="No holidays listed" message="Your HR team has not published the holiday list for this year yet." />
      ) : (
        <Card padded={false}>
          {list.map((h, i) => {
            const date = new Date(h.date);
            const past = h.date.slice(0, 10) < today;
            const isNext = h === next;
            const n = isNext ? daysTo(h.date) : 0;
            return (
              <View key={`${h.date}-${h.name}`} style={[styles.row, { opacity: past ? 0.5 : 1 }, i < list.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                accessible accessibilityLabel={`${h.name}, ${WEEKDAY[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}${h.isOptional ? ', optional' : ''}${past ? ', past' : ''}`}>
                <View style={[styles.chip, { backgroundColor: isNext ? colors.warning : colors.warningSoft }]}>
                  <Text variant="caption" bold style={{ color: isNext ? colors.card : colors.warning, fontSize: 11 }}>{MONTH_SHORT[date.getUTCMonth()].toUpperCase()}</Text>
                  <Text variant="heading" num style={{ color: isNext ? colors.card : colors.warning }}>{date.getUTCDate()}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text bold={isNext}>{h.name}</Text>
                  <Text variant="caption" tone={isNext ? 'warning' : 'secondary'}>{isNext ? (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${plural(n, 'day')}`) : WEEKDAY[date.getUTCDay()]}</Text>
                </View>
                {h.isOptional && <Badge label="Optional" />}
              </View>
            );
          })}
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  chip: { width: 52, borderRadius: radius.md, alignItems: 'center', paddingVertical: space.xs },
});
