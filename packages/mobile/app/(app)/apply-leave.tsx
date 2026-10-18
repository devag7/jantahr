import * as React from 'react';
import { Switch, View } from 'react-native';
import { closeForm } from '@/lib/nav';
import { previewLeave, useApplyLeave, useHolidays, useLeaveBalance } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate, plural } from '@/lib/format';
import { CalendarPicker } from '@/ui/calendar';
import { Button, Card, ErrorState, Field, Loading, Page, Section, Segmented, Text } from '@/ui/kit';
import { ProgressRing } from '@/ui/visual';
import { leaveHue, space, useTheme } from '@/ui/theme';
import type { LeavePreview } from '@/types/leave';

/** Pick the type, the days (holidays are dotted), see how many days it costs, then send it to your manager. */
export default function ApplyLeave() {
  const { colors, dark } = useTheme();
  const balance = useLeaveBalance();
  const year = new Date().getFullYear();
  const holidays = [...(useHolidays(year).data ?? []), ...(useHolidays(year + 1).data ?? [])];
  const apply = useApplyLeave();
  const [typeId, setTypeId] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string | null>(null);
  const [halfDay, setHalfDay] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [preview, setPreview] = React.useState<{ data?: LeavePreview; error?: string } | null>(null);

  const types = balance.data ?? [];
  // start on the everyday kind of leave: casual, then earned or privilege, then whatever has days left
  React.useEffect(() => {
    if (typeId || !types[0]) return;
    const usable = types.filter((t) => !t.isLWP && t.available > 0);
    const prefer = [/casual/i, /privilege|earned|annual/i, /sick/i].map((re) => usable.find((t) => re.test(t.leaveType))).find(Boolean);
    setTypeId((prefer ?? usable[0] ?? types[0]).leaveTypeId);
  }, [types, typeId]);
  const single = !!from && from === to;
  const input = typeId && from && to ? { leaveTypeId: typeId, fromDate: from, toDate: to, halfDay: single && halfDay, halfDayDate: single && halfDay ? from : undefined, reason: reason.trim() || undefined } : null;

  // the API counts the days (weekends, holidays and the sandwich rule depend on the policy)
  React.useEffect(() => {
    if (!input) return setPreview(null);
    let live = true;
    previewLeave(input).then((data) => live && setPreview({ data }), (e) => live && setPreview({ error: errorMessage(e) }));
    return () => { live = false; };
  }, [typeId, from, to, halfDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = types.find((t) => t.leaveTypeId === typeId);
  const short = !!preview?.data && !selected?.isLWP && preview.data.totalDays > preview.data.available;
  const submit = () => input && apply.mutate(input, { onSuccess: () => closeForm('/leave') });

  if (balance.isLoading) return <Loading />;
  if (balance.isError) return <ErrorState message={errorMessage(balance.error)} onRetry={() => void balance.refetch()} />;
  return (
    <Page>
      <Section title="Type">
        <Segmented value={typeId ?? ''} onChange={setTypeId} options={types.map((t) => ({ value: t.leaveTypeId, label: t.isLWP ? t.leaveType : `${t.leaveType} · ${t.available % 1 === 0 ? t.available : t.available.toFixed(1)}` }))} />
      </Section>

      <Section title="Dates">
        <Card>
          <CalendarPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} marked={holidays.map((h) => h.date.slice(0, 10))} />
          <Text variant="caption" tone="tertiary" style={{ marginTop: space.sm }}>Tap the first day, then the last. Dots are holidays.</Text>
        </Card>
        {single && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={{ flex: 1 }}>Half day</Text>
            <Switch value={halfDay} onValueChange={setHalfDay} accessibilityLabel="Half day" trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
          </Card>
        )}
      </Section>

      {from && to && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: short ? colors.dangerSoft : colors.primarySoft }}>
          {/* what is left once this is approved, in the leave type's colour */}
          {preview?.data && selected && !selected.isLWP && (
            <ProgressRing size={60} stroke={6} progress={(selected.allocated + selected.carryForwarded) ? Math.max(0, preview.data.available - preview.data.totalDays) / (selected.allocated + selected.carryForwarded) : 0}
              color={short ? colors.danger : leaveHue(selected.leaveType, dark)} track={colors.card}>
              <Text bold num style={{ fontSize: 16 }}>{short ? '!' : Math.max(0, preview.data.available - preview.data.totalDays)}</Text>
            </ProgressRing>
          )}
          <View style={{ flex: 1, gap: space.xs }}>
            <Text bold>{formatDate(from)}{from !== to ? ` to ${formatDate(to)}` : ''}</Text>
            {preview?.data ? (
              <>
                <Text>{plural(preview.data.totalDays, 'day')} of {preview.data.leaveType}{preview.data.excludedDates.length ? ` (${plural(preview.data.excludedDates.length, 'holiday or weekly off', 'holidays or weekly offs')} not counted)` : ''}</Text>
                {!selected?.isLWP && <Text variant="caption" tone={short ? 'danger' : 'secondary'}>{short ? `Only ${preview.data.available} available` : `${plural(Math.max(0, preview.data.available - preview.data.totalDays), 'day')} left after this`}</Text>}
              </>
            ) : preview?.error ? <Text variant="caption" tone="danger">{preview.error}</Text> : <Text variant="caption" tone="secondary">Counting days…</Text>}
          </View>
        </Card>
      )}

      <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Family function in Pune" />
      <View style={{ gap: space.sm }}>
        <Button title="Apply" loading={apply.isPending} disabled={!input || !preview?.data || short} onPress={submit} />
        <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>Your manager gets a notification to approve it.</Text>
      </View>
    </Page>
  );
}
