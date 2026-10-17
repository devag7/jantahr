import * as React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMySlips } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { webUrl } from '@/lib/config';
import { MONTH_SHORT, formatINR, formatPayMonth } from '@/lib/format';
import { Card, EmptyState, ErrorState, Page, Row, Section, SkeletonCard, Text } from '@/ui/kit';
import { MiniBars } from '@/ui/visual';
import { space, useTheme } from '@/ui/theme';

/** The latest take-home and how it has moved, then every payslip by year; each opens with its breakdown and the PDF. */
export default function Payslips() {
  const { colors } = useTheme();
  const slips = useMySlips();
  const sorted = (slips.data ?? []).slice().sort((a, b) => b.year - a.year || b.month - a.month);
  const latest = sorted[0];
  const trend = sorted.slice(0, 6).reverse();
  const prev = sorted[1];
  const change = latest && prev && prev.netPay ? (latest.netPay - prev.netPay) / prev.netPay : null;
  const byYear = new Map<number, typeof sorted>();
  for (const s of sorted) byYear.set(s.year, [...(byYear.get(s.year) ?? []), s]);

  return (
    <Page title="Payslips" onRefresh={() => void slips.refetch()} refreshing={slips.isRefetching}>
      {slips.isLoading ? <SkeletonCard rows={5} /> : slips.isError ? <ErrorState message={errorMessage(slips.error)} onRetry={() => void slips.refetch()} /> : !latest ? (
        <EmptyState icon="wallet-outline" title="No payslips yet" message="Your payslip appears here once your company runs payroll for the month." />
      ) : (
        <>
          <Card padded={false}>
            <Pressable onPress={() => router.push(`/payslip/${latest.id}`)} accessibilityRole="button" accessibilityLabel={`${formatPayMonth(latest.month, latest.year)} take-home ${formatINR(latest.netPay)}. Open payslip.`}
              android_ripple={Platform.OS === 'android' ? { color: colors.cardPressed, foreground: true } : undefined} style={styles.hero}>
              <View style={{ gap: space.xs }}>
                <Text variant="caption" tone="secondary">{formatPayMonth(latest.month, latest.year)} take-home</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
                  <Text variant="display" num>{formatINR(latest.netPay)}</Text>
                  {change !== null && Math.abs(change) >= 0.005 && (
                    <Text variant="caption" bold tone={change > 0 ? 'success' : 'secondary'}>{change > 0 ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}%</Text>
                  )}
                </View>
                <Text variant="caption" tone="accent" bold>{latest.status === 'PAID' ? 'Paid · ' : ''}View payslip</Text>
              </View>
              {trend.length > 1 && <MiniBars values={trend.map((s) => s.netPay)} labels={trend.map((s) => MONTH_SHORT[s.month - 1])} color={colors.primary} muted={colors.primarySoft} height={72} />}
            </Pressable>
          </Card>

          {[...byYear.entries()].map(([year, list]) => (
            <Section key={year} title={String(year)}>
              <Card padded={false}>
                {list.map((s, i) => (
                  <Row key={s.id} icon="document-text-outline" title={formatPayMonth(s.month, s.year)} subtitle={s.status === 'PAID' ? 'Paid' : 'Processed'} value={formatINR(s.netPay)}
                    onPress={() => router.push(`/payslip/${s.id}`)} last={i === list.length - 1} />
                ))}
              </Card>
            </Section>
          ))}
        </>
      )}
      <Section title="Tax">
        <Card padded={false}>
          <Row icon="calculator-outline" iconTone={colors.leave} title="Tax declaration and Form 16" subtitle="Opens the website" onPress={() => void WebBrowser.openBrowserAsync(webUrl('/me/tax'))} last />
        </Card>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { padding: space.lg, gap: space.lg },
});
