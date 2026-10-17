import * as React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '@/auth/auth';
import { webUrl } from '@/lib/config';
import { Button, Field, Text, type InputRef } from '@/ui/kit';
import { BrandMark } from '@/ui/brand';
import { radius, space, useTheme } from '@/ui/theme';

/** Sign-in: email and password, Google, then the authenticator code for accounts with two-factor. */
export default function SignIn() {
  const { status, notice, signIn, signInWithGoogle, googleAvailable, verifyTotp, signOut, bootstrap } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState<'password' | 'google' | 'code' | 'retry' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const passwordRef = React.useRef<InputRef>(null);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(kind);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const submit = () => {
    if (!email.trim() || !password) return setError('Enter your work email and password.');
    void run('password', () => signIn(email, password));
  };
  const message = error ?? notice;

  let body: React.ReactNode;
  if (status === 'mfa') {
    body = (
      <>
        <Heading title="Two-factor code" subtitle="Enter the 6-digit code from your authenticator app." />
        <Field label="Code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" autoFocus
          onSubmitEditing={() => code.length === 6 && void run('code', () => verifyTotp(code))} />
        {!!message && <Text tone="danger" accessibilityLiveRegion="polite">{message}</Text>}
        <Button title="Verify" loading={busy === 'code'} disabled={code.length !== 6} onPress={() => void run('code', () => verifyTotp(code))} />
        <Button title="Use a different account" kind="ghost" onPress={() => void signOut()} />
      </>
    );
  } else if (status === 'no-account') {
    body = (
      <>
        <Heading title="No JantaHR account" subtitle={notice ?? 'This sign-in is not linked to an employee in any JantaHR company.'} />
        <Text tone="secondary">Ask your HR team to add you with this email address, or create a company workspace on the website.</Text>
        <Button title="Use a different account" onPress={() => void signOut()} />
        <Button title="Create a workspace" kind="secondary" onPress={() => void WebBrowser.openBrowserAsync(webUrl('/signup'))} />
      </>
    );
  } else if (status === 'offline') {
    body = (
      <>
        <Heading title="Cannot reach JantaHR" subtitle={notice ?? 'Check your connection and try again.'} />
        <Button title="Try again" loading={busy === 'retry'} onPress={() => void run('retry', bootstrap)} />
        <Button title="Sign out" kind="ghost" onPress={() => void signOut()} />
      </>
    );
  } else {
    body = (
      <>
        <Heading title="Welcome back" subtitle="Sign in with your work account." />
        <Field label="Work email" value={email} onChangeText={setEmail} placeholder="you@company.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username"
          returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
        <Field ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        {!!message && <Text tone="danger" accessibilityLiveRegion="polite">{message}</Text>}
        <Button title="Sign in" loading={busy === 'password'} disabled={!!busy} onPress={submit} />
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(webUrl('/forgot-password'))} hitSlop={12} style={{ alignSelf: 'center' }} accessibilityRole="link">
          <Text tone="accent">Forgot password?</Text>
        </Pressable>
        {googleAvailable && (
          <>
            <View style={styles.or}><View style={[styles.line, { backgroundColor: colors.border }]} /><Text variant="caption" tone="tertiary">or</Text><View style={[styles.line, { backgroundColor: colors.border }]} /></View>
            <Pressable
              accessibilityRole="button" accessibilityLabel="Continue with Google" disabled={!!busy} onPress={() => void run('google', signInWithGoogle)}
              style={({ pressed }) => [styles.google, { borderColor: colors.border, backgroundColor: pressed ? colors.cardPressed : colors.card, opacity: busy ? 0.6 : 1 }]}
            >
              <Image source={require('../assets/google-g.png')} style={{ width: 20, height: 20 }} accessibilityIgnoresInvertColors />
              <Text bold>{busy === 'google' ? 'Signing in…' : 'Continue with Google'}</Text>
            </Pressable>
          </>
        )}
      </>
    );
  }

  const content = (
    <>
      {/* the brand moment: the mark on cobalt, with quiet rings behind it */}
      <View style={[styles.hero, { paddingTop: insets.top + space.xxl }]}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 360" preserveAspectRatio="xMaxYMin slice" pointerEvents="none">
          {[90, 150, 210, 270].map((r) => <Circle key={r} cx={360} cy={40} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={1.5} fill="none" />)}
        </Svg>
        <View style={[styles.tile, { backgroundColor: colors.brandDeep }]}><BrandMark size={52} /></View>
        <View style={{ gap: space.xs }}>
          <Text variant="display" style={{ color: colors.onBrand }} accessibilityRole="header">JantaHR</Text>
          <Text style={{ color: colors.onBrandMuted }}>Your workday in one place.</Text>
        </View>
        <View style={styles.chips}>
          {([['finger-print', 'Check in'], ['calendar-outline', 'Leave'], ['wallet-outline', 'Payslips'], ['checkmark-done', 'Approvals']] as const).map(([icon, label]) => (
            <View key={label} style={styles.chip}>
              <Ionicons name={icon} size={14} color={colors.ice} />
              <Text variant="caption" style={{ color: colors.onBrand }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.body}>{body}</View>
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand }}>
      <StatusBar style="light" />
      {Platform.OS === 'web' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>{content}</ScrollView>
      ) : (
        // keeps the focused field and the Sign in button above the keyboard
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={space.xxxl + space.xxl} contentContainerStyle={{ flexGrow: 1 }}>{content}</KeyboardAwareScrollView>
      )}
    </View>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ gap: space.sm, marginBottom: space.sm }}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      <Text tone="secondary">{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.xl, paddingBottom: space.xxl + space.xl, gap: space.xl, overflow: 'hidden' },
  tile: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  sheet: { flexGrow: 1, marginTop: -space.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  body: { padding: space.xl, paddingTop: space.xxl, gap: space.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  google: { minHeight: 48, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
});
