import * as React from 'react';
import { Switch } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { closeForm } from '@/lib/nav';
import { useCreateAttendanceRequest } from '@/features/queries';
import { isoDate } from '@/lib/format';
import { CalendarPicker } from '@/ui/calendar';
import { Button, Card, Field, Page, Section, Segmented, Text } from '@/ui/kit';
import { space, useTheme } from '@/ui/theme';
import type { RequestType } from '@/types/attendance';

const KINDS: { value: RequestType; label: string; hint: string }[] = [
  { value: 'REGULARIZE', label: 'Correction', hint: 'You worked but the day shows absent or incomplete (missed check-in, phone trouble).' },
  { value: 'WFH', label: 'Work from home', hint: 'You are working from home on these days.' },
  { value: 'ON_DUTY', label: 'On duty', hint: 'You are working away from office: a client visit, travel, an event.' },
];

/** Ask your manager to mark days correctly: a correction for a past day, or work from home / on duty. */
export default function AttendanceRequest() {
  const { colors } = useTheme();
  const create = useCreateAttendanceRequest();
  // "Correct this day" on the Attendance calendar opens this with the day filled in
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [kind, setKind] = React.useState<RequestType>('REGULARIZE');
  const [from, setFrom] = React.useState<string | null>(date ?? null);
  const [to, setTo] = React.useState<string | null>(date ?? null);
  const [halfDay, setHalfDay] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const today = isoDate(new Date());
  const ready = !!from && !!to && reason.trim().length >= 3;
  const submit = () => from && to && create.mutate({ fromDate: from, toDate: to, requestType: kind, halfDay: from === to && halfDay, reason: reason.trim() }, { onSuccess: () => closeForm('/attendance') });
  return (
    <Page>
      <Section title="Kind">
        <Segmented value={kind} onChange={(k) => { setKind(k); setFrom(null); setTo(null); }} options={KINDS} />
        <Text variant="caption" tone="secondary">{KINDS.find((k) => k.value === kind)!.hint}</Text>
      </Section>
      <Section title="Days">
        <Card>
          <CalendarPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} maxDate={kind === 'REGULARIZE' ? today : undefined} />
        </Card>
        {from && from === to && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={{ flex: 1 }}>Half day</Text>
            <Switch value={halfDay} onValueChange={setHalfDay} accessibilityLabel="Half day" trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
          </Card>
        )}
      </Section>
      <Field label="Reason" value={reason} onChangeText={setReason} multiline maxLength={500} placeholder={kind === 'REGULARIZE' ? 'Forgot to check in; was in office 9:30 to 6' : 'Client visit at Hinjewadi'} />
      <Button title="Send for approval" loading={create.isPending} disabled={!ready} onPress={submit} />
    </Page>
  );
}
