import * as React from 'react';
import { useHolidays } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate, isoDate } from '@/lib/format';
import { Badge, Card, EmptyState, ErrorState, Loading, Page, Row, Segmented } from '@/ui/kit';
import { useTheme } from '@/ui/theme';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The company's holiday list for the year; past ones fade, optional ones are marked. */
export default function Holidays() {
  const { colors } = useTheme();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const q = useHolidays(year);
  const today = isoDate(new Date());
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Segmented value={String(year)} onChange={(y) => setYear(Number(y))} options={[thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y) }))} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : (q.data?.length ?? 0) === 0 ? (
        <EmptyState icon="sunny-outline" title="No holidays listed" message="Your HR team has not published the holiday list for this year yet." />
      ) : (
        <Card padded={false}>
          {q.data!.map((h, i) => {
            const past = h.date.slice(0, 10) < today;
            return (
              <Row key={`${h.date}-${h.name}`} icon="sunny-outline" iconTone={past ? colors.textTertiary : colors.warning} title={h.name}
                subtitle={`${WEEKDAY[new Date(h.date).getUTCDay()]}, ${formatDate(h.date)}`} right={h.isOptional ? <Badge label="Optional" /> : undefined} last={i === q.data!.length - 1} />
            );
          })}
        </Card>
      )}
    </Page>
  );
}
