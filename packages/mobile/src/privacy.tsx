import * as React from 'react';
import { Alert, Switch, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { Body, Button, Card, Muted, Title, useTheme } from '@/theme';

interface Purpose { purpose: string; label: string; description: string; required: boolean; state: 'GRANTED' | 'WITHDRAWN' | 'NOT_ASKED' | 'OUTDATED' }
interface ConsentList { purposes: Purpose[] }

/** DPDP: shows the notice acknowledgement and the optional data uses (selfie, GPS, AI assistant) with immediate on/off. */
export function PrivacyCard() {
  const t = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['consents'], queryFn: () => api<ConsentList>('/privacy/consents') });
  const set = useMutation({
    mutationFn: (v: { purpose: string; granted: boolean }) => api<ConsentList>(`/privacy/consents/${v.purpose}`, { method: 'PUT', body: { granted: v.granted } }),
    onSuccess: (d) => qc.setQueryData(['consents'], d),
    onError: (e: Error) => Alert.alert('Could not save', e.message),
  });
  if (!q.data) return null;
  const notice = q.data.purposes.find((p) => p.required);
  return (
    <Card>
      <Title small>Privacy</Title>
      <Muted style={{ marginTop: 4 }}>Your employer uses your data for employment, payroll and statutory compliance. The full notice, data download and requests are in the web app under “Privacy & my data”.</Muted>
      {notice && notice.state !== 'GRANTED' && (
        <View style={{ marginTop: 10 }}><Button title="I have read the privacy notice" variant="outline" loading={set.isPending} onPress={() => set.mutate({ purpose: notice.purpose, granted: true })} /></View>
      )}
      {q.data.purposes.filter((p) => !p.required).map((p) => {
        const on = p.state !== 'WITHDRAWN';
        return (
          <View key={p.purpose} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}><Body>{p.label}</Body><Muted style={{ marginTop: 2 }}>{p.description}</Muted></View>
            <Switch accessibilityLabel={p.label} value={on} disabled={set.isPending} onValueChange={(v) => set.mutate({ purpose: p.purpose, granted: v })} trackColor={{ true: t.primary, false: t.fill }} />
          </View>
        );
      })}
    </Card>
  );
}
