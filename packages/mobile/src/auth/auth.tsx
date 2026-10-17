import * as React from 'react';
import * as Crypto from 'expo-crypto';
import type { AuthError } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@/types/auth';
import GoogleId from '../../modules/google-id/src/GoogleIdModule';
import { ApiError, api, setAuthProblemHandler } from '@/lib/api';
import { GOOGLE_WEB_CLIENT_ID } from '@/lib/config';
import { supabase } from '@/lib/supabase';

/**
 * - loading: working out the state at start
 * - anonymous: no session (sign-in screen)
 * - mfa: signed in, but the account has two-factor and this session has not entered a code yet
 * - no-account: signed in with Supabase, but no JantaHR employee is linked to this email
 * - offline: a session exists but JantaHR could not be reached (retry)
 * - authenticated: `user` is the JantaHR profile
 */
export type AuthStatus = 'loading' | 'anonymous' | 'mfa' | 'no-account' | 'offline' | 'authenticated';

interface Auth {
  status: AuthStatus;
  user: SessionUser | null;
  /** Why the last attempt did not end signed in (shown on the sign-in screen). */
  notice: string | null;
  bootstrap: () => Promise<AuthStatus>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  googleAvailable: boolean;
  verifyTotp: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = React.createContext<Auth | null>(null);
export function useAuth() {
  const a = React.useContext(AuthContext);
  if (!a) throw new Error('useAuth outside AuthProvider');
  return a;
}

/** Supabase Auth errors in the words the sign-in screen uses (the same as the website's). */
function fail(error: AuthError | null) {
  if (!error) return;
  const byCode: Record<string, string> = {
    invalid_credentials: 'Incorrect email or password.',
    email_not_confirmed: 'Confirm your email address first: open the link we sent you.',
    user_banned: 'Your account is disabled. Contact your HR team.',
    mfa_verification_failed: 'That code did not match. Check the time on your phone and try again.',
    over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  };
  throw new Error((error.code && byCode[error.code]) || error.message);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = React.useState<{ status: AuthStatus; user: SessionUser | null; notice: string | null }>({ status: 'loading', user: null, notice: null });
  const statusRef = React.useRef(state.status);
  statusRef.current = state.status;

  const bootstrap = React.useCallback(async (): Promise<AuthStatus> => {
    const done = (status: AuthStatus, user: SessionUser | null = null, notice: string | null = null) => { setState({ status, user, notice }); return status; };
    const { data } = await supabase.auth.getSession();
    if (!data.session) return done('anonymous');
    try {
      return done('authenticated', await api.get<SessionUser>('/auth/me'));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === 'MFA_REQUIRED') return done('mfa');
      if (code === 'NO_ACCOUNT') return done('no-account', null, (e as Error).message);
      if (code === 'ACCOUNT_DISABLED' || code === 'SSO_NOT_IN_PLAN' || code === 'SESSION_INVALID') {
        await supabase.auth.signOut().catch(() => undefined);
        return done('anonymous', null, code === 'SESSION_INVALID' ? null : (e as Error).message);
      }
      return done('offline', null, (e as Error).message);
    }
  }, []);

  React.useEffect(() => {
    void bootstrap();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { queryClient.clear(); setState({ status: 'anonymous', user: null, notice: null }); }
    });
    // a request that finds the session needs something else (two-factor, a disabled account): re-check
    setAuthProblemHandler((code) => {
      if (statusRef.current !== 'authenticated') return;
      if (code === 'SESSION_INVALID') void supabase.auth.signOut();
      else void bootstrap();
    });
    return () => data.subscription.unsubscribe();
  }, [bootstrap, queryClient]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    fail((await supabase.auth.signInWithPassword({ email: email.trim(), password })).error);
    await bootstrap();
  }, [bootstrap]);

  const signInWithGoogle = React.useCallback(async () => {
    if (!GoogleId) throw new Error('Google sign-in works in the Android app. Sign in with your email here.');
    // Google signs the hash of a one-time nonce into the token and Supabase checks it against the nonce itself,
    // so a token copied from elsewhere cannot be replayed
    const nonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let idToken: string;
    try {
      ({ idToken } = await GoogleId.signIn(GOOGLE_WEB_CLIENT_ID, hashed));
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'ERR_CANCELED') return;
      if (/28444|developer console|not set up|10:/i.test(err.message ?? '')) throw new Error('Google sign-in is not ready for this app version yet. Sign in with your email and password.');
      throw new Error(err.message ?? 'Google sign-in did not complete.');
    }
    fail((await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce })).error);
    await bootstrap();
  }, [bootstrap]);

  const verifyTotp = React.useCallback(async (code: string) => {
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === 'verified');
    if (!factor) throw new Error('No authenticator app is set up for this account. Ask HR to reset your two-factor.');
    fail((await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })).error);
    await bootstrap();
  }, [bootstrap]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined);
    queryClient.clear();
    setState({ status: 'anonymous', user: null, notice: null });
  }, [queryClient]);

  const value = React.useMemo<Auth>(() => ({ ...state, bootstrap, signIn, signInWithGoogle, googleAvailable: !!GoogleId, verifyTotp, signOut }), [state, bootstrap, signIn, signInWithGoogle, verifyTotp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Who approves: anyone with reportees, and the HR roles (who approve for everyone). */
export const isApprover = (u: SessionUser | null) => !!u && (u.hasReportees || ['SUPER_ADMIN', 'HR_ADMIN'].includes(u.role));
/** The website's admin screens: payroll runs, statutory filings, setup. */
export const isBackOffice = (u: SessionUser | null) => !!u && ['SUPER_ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN', 'AUDITOR'].includes(u.role);
