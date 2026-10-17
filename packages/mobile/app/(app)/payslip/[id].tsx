import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSlip } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { openFile } from '@/lib/files';
import { formatINR, formatPayMonth, monthLabel } from '@/lib/format';
import { Button, Card, Divider, ErrorState, Loading, Page, Section, Text } from '@/ui/kit';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/overlays';

/** One payslip: take-home first, then where it came from, then the PDF to save or share. */
export default function Payslip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const slip = useSlip(id);
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const s = slip.data;
  const download = async () => {
    if (!s) return;
    setBusy(true);
    try { await openFile(`/payroll/payslips/${s.id}/pdf`, `Payslip ${monthLabel(s.month, s.year)}.pdf`); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Page>
      <Stack.Screen options={{ title: s ? formatPayMonth(s.month, s.year) : 'Payslip' }} />
      {slip.isLoading ? <Loading /> : slip.isError || !s ? <ErrorState message={errorMessage(slip.error)} onRetry={() => void slip.refetch()} /> : (
        <>
          <Card style={{ gap: space.xs, alignItems: 'center', paddingVertical: space.xl }}>
            <Text variant="caption" tone="secondary">Take-home for {monthLabel(s.month, s.year)}</Text>
            <Text variant="title" num style={{ fontSize: 36, lineHeight: 42 }}>{formatINR(s.roundedTotal || s.netPay)}</Text>
            <Text variant="caption" tone="secondary">Paid days {s.paymentDays} of {new Date(s.year, s.month, 0).getDate()}{s.leaveWithoutPay + s.absentDays > 0 ? ` · loss of pay ${s.leaveWithoutPay + s.absentDays}` : ''} · {s.taxRegime === 'NEW' ? 'New' : 'Old'} tax regime</Text>
          </Card>
          <Lines title="Earnings" lines={s.earnings} total={s.grossPay} totalLabel="Gross pay" />
          <Lines title="Deductions" lines={s.deductions} total={s.totalDeductions} totalLabel="Total deductions" />
          {s.employerContribution > 0 && <Text variant="caption" tone="secondary">Your employer also paid {formatINR(s.employerContribution)} towards your PF, ESI and other benefits.</Text>}
          <Button title="Download PDF" icon="download-outline" loading={busy} onPress={() => void download()} />
        </>
      )}
    </Page>
  );
}

function Lines({ title, lines, total, totalLabel }: { title: string; lines: { name: string; amount: number }[]; total: number; totalLabel: string }) {
  return (
    <Section title={title}>
      <Card style={{ gap: space.md }}>
        {lines.filter((l) => l.amount).map((l) => (
          <View key={l.name} style={styles.line}><Text tone="secondary" style={{ flex: 1 }}>{l.name}</Text><Text num>{formatINR(l.amount)}</Text></View>
        ))}
        <Divider />
        <View style={styles.line}><Text bold style={{ flex: 1 }}>{totalLabel}</Text><Text bold num>{formatINR(total)}</Text></View>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({ line: { flexDirection: 'row', alignItems: 'center', gap: space.md } });
