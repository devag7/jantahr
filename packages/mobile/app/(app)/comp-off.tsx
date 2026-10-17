import * as React from 'react';
import { Switch } from 'react-native';
import { closeForm } from '@/lib/nav';
import { useRequestCompOff } from '@/features/queries';
import { isoDate } from '@/lib/format';
import { CalendarPicker } from '@/ui/calendar';
import { Button, Card, Field, Page, Section, Text } from '@/ui/kit';
import { space, useTheme } from '@/ui/theme';

/** Worked on a holiday or weekly off: ask for those days back as compensatory leave. */
export default function CompOff() {
  const { colors } = useTheme();
  const request = useRequestCompOff();
  const [from, setFrom] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string | null>(null);
  const [halfDay, setHalfDay] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const submit = () => from && to && request.mutate({ workFromDate: from, workEndDate: to, halfDay: from === to && halfDay, reason: reason.trim() }, { onSuccess: () => closeForm('/leave') });
  return (
    <Page>
      <Text tone="secondary">Pick the holiday or weekly off you worked. Once approved, the days are added to your comp-off balance.</Text>
      <Section title="Days you worked">
        <Card><CalendarPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} maxDate={isoDate(new Date())} /></Card>
        {from && from === to && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={{ flex: 1 }}>Half day</Text>
            <Switch value={halfDay} onValueChange={setHalfDay} accessibilityLabel="Half day" trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
          </Card>
        )}
      </Section>
      <Field label="What you worked on" value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Month-end payroll close" />
      <Button title="Send for approval" loading={request.isPending} disabled={!from || !to || reason.trim().length < 3} onPress={submit} />
    </Page>
  );
}
