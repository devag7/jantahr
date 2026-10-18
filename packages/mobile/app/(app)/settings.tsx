import * as React from 'react';
import { Alert, Switch } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/auth/auth';
import { useAppLock } from '@/auth/lock';
import { webUrl } from '@/lib/config';
import { Card, Page, Row, Section, Text } from '@/ui/kit';
import { useTheme } from '@/ui/theme';

const web = (path: string) => () => void WebBrowser.openBrowserAsync(webUrl(path));

export default function Settings() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const lock = useAppLock();
  const toggle = async (on: boolean) => {
    if (on && !lock.available) return Alert.alert('No screen lock on this phone', 'Set up a fingerprint, face or PIN in Android settings first.');
    await lock.setEnabled(on);
  };
  return (
    <Page>
      <Section title="Security">
        <Card padded={false}>
          <Row icon="finger-print" iconTone={colors.primary} title="App lock" subtitle="Ask for your fingerprint, face or PIN when JantaHR opens"
            right={<Switch value={lock.enabled} onValueChange={(v) => void toggle(v)} accessibilityLabel="App lock" trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />} />
          <Row icon="key-outline" iconTone={colors.warning} title="Change password" subtitle="Opens the website" onPress={web('/me/profile')} />
          <Row icon="shield-checkmark-outline" iconTone={colors.success} title="Two-factor sign-in" subtitle={user?.mfaEnabled ? 'On' : 'Off · set it up on the website'} onPress={web('/me/profile')} last />
        </Card>
      </Section>
      <Section title="About">
        <Card padded={false}>
          <Row icon="lock-closed-outline" iconTone={colors.leave} title="Privacy notice" onPress={web('/legal/privacy')} />
          <Row icon="document-text-outline" iconTone={colors.holiday} title="Terms of service" onPress={web('/legal/terms')} />
          <Row icon="trash-outline" iconTone={colors.danger} title="Delete my account" subtitle="How it works and what is kept" onPress={web('/legal/delete-account')} last />
        </Card>
      </Section>
      <Text variant="caption" tone="tertiary">Signed in as {user?.email}</Text>
    </Page>
  );
}
