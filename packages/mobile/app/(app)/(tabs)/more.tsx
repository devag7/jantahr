import * as React from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { isApprover, isBackOffice, useAuth } from '@/auth/auth';
import { useEss, useHasFeature, useNotifications } from '@/features/queries';
import { SUPPORT_EMAIL, webUrl } from '@/lib/config';
import { initials } from '@/lib/format';
import { Badge, Card, Page, Row, Section, Text } from '@/ui/kit';
import { space, useTheme } from '@/ui/theme';

const web = (path: string) => () => void WebBrowser.openBrowserAsync(webUrl(path));

/** Everything else: approvals and team for managers, expenses, documents, settings, and the website for HR work. */
export default function More() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const ess = useEss();
  const notes = useNotifications();
  const hasExpenses = useHasFeature('expenses');
  const approvals = ess.data?.pendingApprovals?.total ?? 0;
  const unread = notes.data?.unreadCount ?? 0;
  const name = user?.employee?.fullName ?? user?.email ?? '';
  const role = user?.employee?.designation?.name ?? user?.role.replace(/_/g, ' ').toLowerCase();

  const confirmSignOut = () => Alert.alert('Sign out of JantaHR?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOut() }]);

  return (
    <Page>
      <Card style={styles.me}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Text variant="heading" tone="accent">{initials(name)}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text bold numberOfLines={1}>{name}</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>{[role, user?.employee?.employeeCode].filter(Boolean).join(' · ')}</Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>{user?.company.name}</Text>
        </View>
      </Card>

      {isApprover(user) && (
        <Section title="Manage">
          <Card padded={false}>
            <Row icon="checkmark-done-outline" title="Approvals" subtitle="Leave, attendance, expenses and more" right={approvals ? <Badge label={String(approvals)} tone="danger" /> : undefined} onPress={() => router.push('/approvals')} />
            <Row icon="people-outline" title="My team" subtitle="Who is in today" onPress={() => router.push('/team')} last />
          </Card>
        </Section>
      )}

      <Section title="Me">
        <Card padded={false}>
          <Row icon="notifications-outline" title="Notifications" right={unread ? <Badge label={String(unread)} tone="danger" /> : undefined} onPress={() => router.push('/notifications')} />
          {hasExpenses && <Row icon="receipt-outline" title="Expenses" subtitle="Claims and reimbursements" onPress={() => router.push('/expenses')} />}
          <Row icon="document-attach-outline" title="My documents" onPress={() => router.push('/documents')} />
          <Row icon="reader-outline" title="Policies" onPress={() => router.push('/policies')} />
          <Row icon="sunny-outline" title="Holidays" onPress={() => router.push('/holidays')} />
          <Row icon="person-circle-outline" title="Profile" subtitle="Contact details and emergency contact" onPress={() => router.push('/profile')} last />
        </Card>
      </Section>

      <Section title={isBackOffice(user) ? 'HR and payroll' : 'More on the website'}>
        <Card padded={false}>
          {isBackOffice(user) ? (
            <>
              <Row icon="people-circle-outline" title="Employees" subtitle="Opens the website" onPress={web('/hr/employees')} />
              <Row icon="cash-outline" title="Payroll" subtitle="Runs, statutory filings and reports" onPress={web('/hr/payroll')} />
              <Row icon="desktop-outline" title="Open JantaHR on the web" subtitle="Everything else: setup, reports, settings" onPress={web('/dashboard')} last />
            </>
          ) : (
            <>
              <Row icon="help-buoy-outline" title="Helpdesk" subtitle="Raise a question to HR" onPress={web('/me/helpdesk')} />
              <Row icon="trending-up-outline" title="Goals and reviews" onPress={web('/me/performance')} />
              <Row icon="shield-checkmark-outline" title="Privacy and my data" onPress={web('/me/privacy')} last />
            </>
          )}
        </Card>
        <Text variant="caption" tone="tertiary">Sign in once in the browser; it stays signed in.</Text>
      </Section>

      <Section title="App">
        <Card padded={false}>
          <Row icon="settings-outline" title="Settings" subtitle="App lock, password, two-factor" onPress={() => router.push('/settings')} />
          <Row icon="mail-outline" title="Contact support" subtitle={SUPPORT_EMAIL} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=JantaHR%20app`)} />
          <Row icon="log-out-outline" iconTone={colors.danger} title="Sign out" onPress={confirmSignOut} chevron={false} last />
        </Card>
      </Section>
      <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>JantaHR {Constants.expoConfig?.version}</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
