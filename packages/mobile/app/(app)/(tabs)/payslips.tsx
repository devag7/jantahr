import * as React from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMySlips } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { webUrl } from '@/lib/config';
import { formatINR, formatPayMonth } from '@/lib/format';
import { Card, EmptyState, ErrorState, Loading, Page, Row, Section } from '@/ui/kit';

/** Every payslip, newest first; each opens with its breakdown and the PDF. */
export default function Payslips() {
  const slips = useMySlips();
  const byYear = new Map<number, NonNullable<typeof slips.data>>();
  for (const s of (slips.data ?? []).slice().sort((a, b) => b.year - a.year || b.month - a.month)) byYear.set(s.year, [...(byYear.get(s.year) ?? []), s]);

  return (
    <Page onRefresh={() => void slips.refetch()} refreshing={slips.isRefetching}>
      {slips.isLoading ? <Loading /> : slips.isError ? <ErrorState message={errorMessage(slips.error)} onRetry={() => void slips.refetch()} /> : byYear.size === 0 ? (
        <EmptyState icon="wallet-outline" title="No payslips yet" message="Your payslip appears here once your company runs payroll for the month." />
      ) : (
        [...byYear.entries()].map(([year, list]) => (
          <Section key={year} title={String(year)}>
            <Card padded={false}>
              {list.map((s, i) => (
                <Row key={s.id} icon="document-text-outline" title={formatPayMonth(s.month, s.year)} subtitle={s.status === 'PAID' ? 'Paid' : 'Processed'} value={formatINR(s.netPay)}
                  onPress={() => router.push(`/payslip/${s.id}`)} last={i === list.length - 1} />
              ))}
            </Card>
          </Section>
        ))
      )}
      <Section title="Tax">
        <Card padded={false}>
          <Row icon="calculator-outline" title="Tax declaration and Form 16" subtitle="Opens the website" onPress={() => void WebBrowser.openBrowserAsync(webUrl('/me/tax'))} last />
        </Card>
      </Section>
    </Page>
  );
}
