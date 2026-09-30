import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/auth';
import { Button, Field, Heading, Muted, type, useTheme } from '@/theme';

export default function Login() {
  const t = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [mfa, setMfa] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await login(email, password, mfa ? code : undefined);
      if (r.mfaRequired) setMfa(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center' }}><Text style={[type.title, { color: t.onInk, fontWeight: '700' }]}>JH</Text></View>
          <Text style={[type.title, { color: t.text, marginTop: 12 }]}>JantaHR</Text>
        </View>
        <Heading>{mfa ? 'Two-factor code' : 'Sign in'}</Heading>
        {error && <Text accessibilityRole="alert" style={[type.caption, { color: t.danger, marginBottom: 12 }]}>{error}</Text>}
        {!mfa ? (
          <>
            <Field label="Work email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" />
          </>
        ) : (
          <Field label="6-digit authentication code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} autoFocus />
        )}
        <Button title={mfa ? 'Verify' : 'Sign in'} onPress={submit} loading={busy} disabled={!email || !password} />
        <Muted style={{ textAlign: 'center', marginTop: 16 }}>Forgot your password? Reset it from the web app.</Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
