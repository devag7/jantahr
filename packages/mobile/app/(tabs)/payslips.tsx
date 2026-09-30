import * as React from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQuery } from '@tanstack/react-query';
import { API_URL, api, authedDownloadHeaders } from '@/api';
import { Body, Card, Muted, MONTHS, inr, type, useTheme } from '@/theme';
import type { Slip } from '@/types';

export default function Payslips() {
  const t = useTheme();
  const q = useQuery({ queryKey: ['slips'], queryFn: () => api<Slip[]>('/payroll/payslips/me') });
  const [busy, setBusy] = React.useState<string | null>(null);

  const open = async (s: Slip) => {
    setBusy(s.id);
    try {
      const target = `${FileSystem.cacheDirectory}Payslip_${s.year}-${String(s.month).padStart(2, '0')}.pdf`;
      const res = await FileSystem.downloadAsync(`${API_URL}/payroll/payslips/${s.id}/pdf`, target, { headers: await authedDownloadHeaders() });
      if (res.status !== 200) throw new Error('Download failed');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(res.uri, { mimeType: 'application/pdf', dialogTitle: 'Payslip' });
      else Alert.alert('Saved', res.uri);
    } catch (e) {
      Alert.alert('Could not open payslip', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  return (
    <FlatList style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 10 }} data={q.data ?? []} keyExtractor={(s) => s.id} refreshing={q.isRefetching} onRefresh={() => q.refetch()}
      ListEmptyComponent={<Muted>{q.isLoading ? 'Loading…' : q.error ? (q.error as Error).message : 'No payslips published yet.'}</Muted>}
      renderItem={({ item: s }) => (
        <Pressable onPress={() => open(s)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })} accessibilityRole="button" accessibilityLabel={`Payslip ${MONTHS[s.month - 1]} ${s.year}`}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: busy === s.id ? 0.5 : 1 }}>
            <View><Body style={{ fontWeight: '600' }}>{MONTHS[s.month - 1]} {s.year}</Body><Muted>Gross {inr(s.grossPay)}</Muted></View>
            <Body style={[type.title, { fontVariant: ['tabular-nums'] }]}>{inr(s.netPay)}</Body>
          </Card>
        </Pressable>
      )} />
  );
}
