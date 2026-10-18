import * as React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useMyProfile, useUpdateMyProfile } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate, plural } from '@/lib/format';
import { Button, Card, ErrorState, Field, LinkButton, Loading, Page, Row, Section, Text } from '@/ui/kit';
import { Avatar } from '@/ui/visual';
import { space } from '@/ui/theme';
import type { Employee } from '@/types/employees';

/** The fields employees may change themselves (the API's UpdateSelfDto); the rest is shown, and HR changes it. */
const EDITABLE = [
  { key: 'phone', label: 'Mobile number', keyboard: 'phone-pad' },
  { key: 'personalEmail', label: 'Personal email', keyboard: 'email-address' },
  { key: 'currentAddress', label: 'Current address', multiline: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'PIN code', keyboard: 'number-pad' },
  { key: 'bloodGroup', label: 'Blood group' },
  { key: 'emergencyContactName', label: 'Emergency contact name' },
  { key: 'emergencyContactPhone', label: 'Emergency contact phone', keyboard: 'phone-pad' },
  { key: 'emergencyContactRelation', label: 'Relationship' },
] as const;
type Key = (typeof EDITABLE)[number]['key'];

/** "2 years 3 months at the company" from the joining date. */
function tenure(joined: string) {
  const d = new Date(joined), now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0);
  if (months < 1) return 'Joined this month';
  const y = Math.floor(months / 12), m = months % 12;
  return `${[y && plural(y, 'year'), m && plural(m, 'month')].filter(Boolean).join(' ')} at the company`;
}

export default function Profile() {
  const q = useMyProfile();
  const update = useUpdateMyProfile();
  const [edit, setEdit] = React.useState<Partial<Record<Key, string>> | null>(null);
  const e = q.data;
  const start = () => e && setEdit(Object.fromEntries(EDITABLE.map((f) => [f.key, (e[f.key as keyof Employee] as string | null) ?? ''])));
  const save = () => {
    if (!edit) return;
    const changed = Object.fromEntries(Object.entries(edit).filter(([k, v]) => v !== ((e?.[k as keyof Employee] as string | null) ?? '')).map(([k, v]) => [k, v?.trim() || undefined]));
    if (!Object.keys(changed).length) return setEdit(null);
    update.mutate(changed as Partial<Employee>, { onSuccess: () => setEdit(null) });
  };

  if (q.isLoading) return <Loading />;
  if (q.isError || !e) return <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />;
  return (
    <Page>
      <Stack.Screen options={{ headerRight: () => (edit ? <LinkButton title={update.isPending ? 'Saving…' : 'Save'} onPress={save} /> : <LinkButton title="Edit" onPress={start} />) }} />
      {!edit && (
        <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
          <Avatar name={e.fullName} size={84} />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="heading" style={{ textAlign: 'center' }}>{e.fullName}</Text>
            <Text tone="secondary" style={{ textAlign: 'center' }}>{[e.designation?.name, e.department?.name].filter(Boolean).join(' · ')}</Text>
            <Text variant="caption" tone="tertiary">{tenure(e.dateOfJoining)}</Text>
          </View>
        </Card>
      )}
      <Section title="Work">
        <Card padded={false}>
          <Row title="Employee code" value={e.employeeCode} />
          <Row title="Work email" subtitle={e.email} />
          <Row title="Department" value={e.department?.name ?? '-'} />
          <Row title="Designation" value={e.designation?.name ?? '-'} />
          {e.reportingManager && <Row title="Reports to" value={`${e.reportingManager.firstName} ${e.reportingManager.lastName}`} />}
          <Row title="Joined" value={formatDate(e.dateOfJoining)} last />
        </Card>
      </Section>
      <Section title="Personal">
        {edit ? (
          <View style={{ gap: space.lg }}>
            {EDITABLE.map((f) => (
              <Field key={f.key} label={f.label} value={edit[f.key] ?? ''} onChangeText={(t) => setEdit({ ...edit, [f.key]: t })}
                keyboardType={'keyboard' in f ? f.keyboard : 'default'} multiline={'multiline' in f} autoCapitalize={f.key === 'personalEmail' ? 'none' : 'sentences'} />
            ))}
            <Button title="Save changes" loading={update.isPending} onPress={save} />
            <Button title="Cancel" kind="ghost" onPress={() => setEdit(null)} />
          </View>
        ) : (
          <Card padded={false}>
            {EDITABLE.map((f, i) => <Row key={f.key} title={f.label} subtitle={(e[f.key as keyof Employee] as string | null) || 'Not added'} last={i === EDITABLE.length - 1} />)}
          </Card>
        )}
      </Section>
      {!edit && <Text variant="caption" tone="tertiary">Name, date of birth, bank and ID details are changed by your HR team.</Text>}
    </Page>
  );
}
