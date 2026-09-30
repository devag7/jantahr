import * as React from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { Body, Button, Card, Field, Heading, Muted, StatusPill, Title, humanize, shortDate, type, useTheme } from '@/theme';
import type { LeaveApplication, LeaveBalance, LeavePreview } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);

function ApplyForm({ balances, onClose }: { balances: LeaveBalance[]; onClose: () => void }) {
  const t = useTheme();
  const qc = useQueryClient();
  const types = balances;
  const [typeId, setTypeId] = React.useState(types.find((b) => b.leaveType === 'Casual Leave')?.leaveTypeId ?? types[0]?.leaveTypeId ?? '');
  const [from, setFrom] = React.useState(today());
  const [to, setTo] = React.useState(today());
  const [reason, setReason] = React.useState('');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && to >= from && !!typeId;
  const preview = useQuery({ queryKey: ['leave-preview', typeId, from, to], queryFn: () => api<LeavePreview>('/leave/preview', { method: 'POST', body: { leaveTypeId: typeId, fromDate: from, toDate: to } }), enabled: valid, retry: false });
  const submit = useMutation({
    mutationFn: () => api('/leave/applications', { method: 'POST', body: { leaveTypeId: typeId, fromDate: from, toDate: to, reason: reason || undefined } }),
    onSuccess: () => { qc.invalidateQueries(); onClose(); },
    onError: (e) => Alert.alert('Could not apply', e instanceof Error ? e.message : 'Try again'),
  });
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Heading>Apply for leave</Heading>
      <Text style={[type.caption, { color: t.text, fontWeight: '600', marginBottom: 8 }]}>Leave type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {types.map((b) => (
          <Pressable key={b.leaveTypeId} onPress={() => setTypeId(b.leaveTypeId)} accessibilityRole="radio" accessibilityState={{ selected: typeId === b.leaveTypeId }} style={({ pressed }) => ({ paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: typeId === b.leaveTypeId ? t.primary : t.input, backgroundColor: typeId === b.leaveTypeId ? t.primary : 'transparent', transform: [{ scale: pressed ? 0.95 : 1 }] })}>
            <Text style={[type.caption, { color: typeId === b.leaveTypeId ? t.onPrimary : t.text }]}>{b.leaveType} ({b.available})</Text>
          </Pressable>
        ))}
      </View>
      <Field label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <Field label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
      {preview.data && <Card style={{ marginBottom: 14 }}><Body>{preview.data.totalDays} day(s) will be deducted · {preview.data.available} available</Body></Card>}
      {preview.error && <Text style={[type.caption, { color: t.danger, marginBottom: 12 }]}>{(preview.error as Error).message}</Text>}
      <View style={{ gap: 10 }}><Button title="Submit request" onPress={() => submit.mutate()} loading={submit.isPending} disabled={!valid || !!preview.error} /><Button title="Cancel" variant="outline" onPress={onClose} /></View>
    </ScrollView>
  );
}

export default function Leave() {
  const t = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const balances = useQuery({ queryKey: ['balance'], queryFn: () => api<LeaveBalance[]>('/leave/balance') });
  const apps = useQuery({ queryKey: ['leave-apps'], queryFn: () => api<{ items: LeaveApplication[] }>('/leave/applications?scope=mine&limit=30') });
  const cancel = useMutation({ mutationFn: (id: string) => api(`/leave/applications/${id}/cancel`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries(), onError: (e) => Alert.alert('Could not cancel', (e as Error).message) });
  const tone = (s: string) => (s === 'APPROVED' ? t.success : s === 'OPEN' ? t.warning : t.muted);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Button title="Apply for leave" onPress={() => setOpen(true)} disabled={!balances.data?.length} />
        {balances.data?.filter((b) => !b.isLWP).map((b) => <Card key={b.leaveTypeId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Body>{b.leaveType}</Body><Body style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{b.available} left{b.pending ? ` (${b.pending} pending)` : ''}</Body></Card>)}
        <Title style={{ marginTop: 8 }}>My requests</Title>
        {apps.data?.items.length === 0 && <Muted>No leave requests yet.</Muted>}
        {apps.data?.items.map((a) => (
          <Card key={a.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Body style={{ fontWeight: '600' }}>{a.leaveType.name}</Body><StatusPill label={humanize(a.status)} color={tone(a.status)} /></View>
            <Muted style={{ marginTop: 2 }}>{shortDate(a.fromDate)}{a.toDate.slice(0, 10) !== a.fromDate.slice(0, 10) ? ` to ${shortDate(a.toDate)}` : ''} · {a.totalLeaveDays} day(s)</Muted>
            {(a.status === 'OPEN' || a.status === 'APPROVED') && new Date(a.fromDate) > new Date() && <Pressable accessibilityRole="button" onPress={() => cancel.mutate(a.id)} style={{ marginTop: 8, minHeight: 44, justifyContent: 'center' }}><Text style={[type.body, { color: t.danger }]}>Cancel request</Text></Pressable>}
          </Card>
        ))}
      </ScrollView>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>{balances.data && <ApplyForm balances={balances.data} onClose={() => setOpen(false)} />}</View>
      </Modal>
    </View>
  );
}
