import * as React from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { isApprover, isBackOffice, useAuth } from '@/auth/auth';
import { useEss, useHasFeature, useNotifications } from '@/features/queries';
import { SUPPORT_EMAIL, webUrl } from '@/lib/config';
import { Badge, Card, Page, Row, Section, Text } from '@/ui/kit';
import { BrandMark } from '@/ui/brand';
import { Avatar } from '@/ui/visual';
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
    <Page title="More">
      <Card padded={false}>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={`${name}, open profile`}
          android_ripple={Platform.OS === 'android' ? { color: colors.cardPressed, foreground: true } : undefined} style={styles.me}>
          <Avatar name={name} size={60} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading" numberOfLines={1}>{name}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>{[role, user?.employee?.employeeCode].filter(Boolean).join(' · ')}</Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>{user?.company.name}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      </Card>

      {isApprover(user) && (
        <Section title="Manage">
          <Card padded={false}>
            <Row icon="checkmark-done-outline" title="Approvals" subtitle="Leave, attendance, expenses and more" right={approvals ? <Badge label={String(approvals)} tone="danger" /> : undefined} onPress={() => router.push('/approvals')} />
            <Row icon="people-outline" iconTone={colors.success} title="My team" subtitle="Who is in today" onPress={() => router.push('/team')} last />
          </Card>
        </Section>
      )}

      <Section title="Me">
        <Card padded={false}>
          <Row icon="notifications-outline" iconTone={colors.danger} title="Notifications" right={unread ? <Badge label={String(unread)} tone="danger" /> : undefined} onPress={() => router.push('/notifications')} />
          {hasExpenses && <Row icon="receipt-outline" iconTone={colors.warning} title="Expenses" subtitle="Claims and reimbursements" onPress={() => router.push('/expenses')} />}
          <Row icon="document-attach-outline" iconTone={colors.holiday} title="My documents" onPress={() => router.push('/documents')} />
          <Row icon="reader-outline" iconTone={colors.leave} title="Policies" onPress={() => router.push('/policies')} />
          <Row icon="sunny-outline" iconTone={colors.warning} title="Holidays" onPress={() => router.push('/holidays')} />
          <Row icon="person-circle-outline" title="Profile" subtitle="Contact details and emergency contact" onPress={() => router.push('/profile')} last />
        </Card>
      </Section>

      <Section title={isBackOffice(user) ? 'HR and payroll' : 'More on the website'}>
        <Card padded={false}>
          {isBackOffice(user) ? (
            <>
              <Row icon="people-circle-outline" title="Employees" subtitle="Opens the website" onPress={web('/hr/employees')} />
              <Row icon="cash-outline" iconTone={colors.success} title="Payroll" subtitle="Runs, statutory filings and reports" onPress={web('/hr/payroll')} />
              <Row icon="desktop-outline" title="Open JantaHR on the web" subtitle="Everything else: setup, reports, settings" onPress={web('/dashboard')} last />
            </>
          ) : (
            <>
              <Row icon="help-buoy-outline" iconTone={colors.holiday} title="Helpdesk" subtitle="Raise a question to HR" onPress={web('/me/helpdesk')} />
              <Row icon="trending-up-outline" iconTone={colors.success} title="Goals and reviews" onPress={web('/me/performance')} />
              <Row icon="shield-checkmark-outline" iconTone={colors.leave} title="Privacy and my data" onPress={web('/me/privacy')} last />
            </>
          )}
        </Card>
        <Text variant="caption" tone="tertiary">Sign in once in the browser; it stays signed in.</Text>
      </Section>

      <Section title="App">
        <Card padded={false}>
          <Row icon="settings-outline" iconTone={colors.textSecondary} title="Settings" subtitle="App lock, password, two-factor" onPress={() => router.push('/settings')} />
          <Row icon="mail-outline" iconTone={colors.holiday} title="Contact support" subtitle={SUPPORT_EMAIL} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=JantaHR%20app`)} />
          <Row icon="log-out-outline" iconTone={colors.danger} title="Sign out" onPress={confirmSignOut} chevron={false} last />
        </Card>
      </Section>
      <View style={styles.footer}>
        <BrandMark size={28} mono={colors.textTertiary} />
        <Text variant="caption" tone="tertiary">JantaHR {Constants.expoConfig?.version}</Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  footer: { alignItems: 'center', gap: space.xs, paddingTop: space.sm },
});
