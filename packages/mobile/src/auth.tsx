import * as React from 'react';
import { ApiError, api, setAuthProblemHandler } from './api';
import { supabase } from './supabase';
import type { SessionUser } from './types';

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  /** Signs in with Supabase; `mfaCode` completes the two-factor step for accounts that have it. */
  login: (email: string, password: string, mfaCode?: string) => Promise<{ mfaRequired: boolean }>;
  logout: () => Promise<void>;
}
const Ctx = React.createContext<AuthCtx | null>(null);

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Confirm your email address first.',
  user_banned: 'Your account is disabled. Contact your HR team.',
  mfa_verification_failed: 'That code did not match. Try again.',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  /** JantaHR profile for the current Supabase session; `mfa` when the account needs its second factor first. */
  const resolve = React.useCallback(async (): Promise<'ok' | 'mfa' | 'none'> => {
    if (!(await supabase.auth.getSession()).data.session) { setUser(null); return 'none'; }
    try {
      setUser(await api<SessionUser>('/auth/me'));
      return 'ok';
    } catch (e) {
      if (e instanceof ApiError && e.code === 'MFA_REQUIRED') return 'mfa';
      await supabase.auth.signOut().catch(() => undefined);
      setUser(null);
      throw e;
    }
  }, []);

  React.useEffect(() => {
    setAuthProblemHandler((code) => { if (code !== 'MFA_REQUIRED') { void supabase.auth.signOut(); setUser(null); } });
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') setUser(null); });
    resolve().catch(() => undefined).finally(() => setLoading(false));
    return () => data.subscription.unsubscribe();
  }, [resolve]);

  const login: AuthCtx['login'] = async (email, password, mfaCode) => {
    if (mfaCode) {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp.find((f) => f.status === 'verified');
      if (!factor) throw new Error('No authenticator app is set up for this account.');
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: mfaCode });
      if (error) throw new Error(MESSAGES[error.code ?? ''] ?? error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(MESSAGES[error.code ?? ''] ?? error.message);
    }
    return { mfaRequired: (await resolve()) === 'mfa' };
  };
  const logout = async () => {
    await supabase.auth.signOut().catch(() => undefined);
    setUser(null);
  };
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
