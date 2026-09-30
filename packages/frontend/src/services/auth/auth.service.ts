import type { AuthError } from '@supabase/supabase-js';
import { get, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import { createClient } from '@/lib/supabase/client';
import type { CompanyDetails, SessionUser, SignupInput, TotpEnrolment } from '@/types/auth';
import type { Ok } from '@/types/common';

/** Where a new workspace's details wait (Supabase user metadata) while the owner confirms their email. */
export const SIGNUP_METADATA_KEY = 'jantahr_signup';

const auth = () => createClient().auth;
const callbackUrl = (next?: string) => `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

/** Supabase Auth errors in the words the sign-in screens use. */
function fail(error: AuthError | null): void {
  if (!error) return;
  const byCode: Record<string, string> = {
    invalid_credentials: 'Incorrect email or password.',
    email_not_confirmed: 'Confirm your email address first: open the link we sent you.',
    user_banned: 'Your account is disabled. Contact your HR team.',
    mfa_verification_failed: 'That code did not match. Check the time on your phone and try again.',
    over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
    over_email_send_rate_limit: 'Too many emails were sent. Wait a few minutes and try again.',
    user_already_exists: 'An account with this email already exists. Sign in instead.',
    weak_password: error.message,
  };
  throw new Error((error.code && byCode[error.code]) || error.message);
}

export const authService = {
  // ---- Supabase Auth ----
  signIn: async (email: string, password: string) => fail((await auth().signInWithPassword({ email, password })).error),
  signOut: async () => { await auth().signOut(); },
  sendMagicLink: async (email: string) => {
    const { error } = await auth().signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false } });
    // an unknown address answers "signups not allowed"; report success either way so accounts cannot be probed
    if (error?.code !== 'otp_disabled' && !/signups not allowed/i.test(error?.message ?? '')) fail(error);
  },
  signInWithGoogle: async () => fail((await auth().signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } })).error),
  sendPasswordReset: async (email: string) => fail((await auth().resetPasswordForEmail(email, { redirectTo: callbackUrl('/reset-password') })).error),
  /** Creates the Supabase account; returns whether the email must be confirmed before the workspace can be created. */
  signUp: async ({ email, password, ...company }: SignupInput) => {
    const { data, error } = await auth().signUp({ email, password, options: { data: { [SIGNUP_METADATA_KEY]: company }, emailRedirectTo: callbackUrl() } });
    fail(error);
    return { needsConfirmation: !data.session };
  },
  exchangeCode: async (code: string) => fail((await auth().exchangeCodeForSession(code)).error),
  pendingCompany: async (): Promise<CompanyDetails | null> => {
    const { data } = await auth().getUser();
    return (data.user?.user_metadata?.[SIGNUP_METADATA_KEY] as CompanyDetails | undefined) ?? null;
  },
  hasSession: async () => !!(await auth().getSession()).data.session,

  /** Step the session up to AAL2 with the user's authenticator app. */
  verifyTotp: async (code: string) => {
    const { data } = await auth().mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === 'verified');
    if (!factor) throw new Error('No authenticator app is set up for this account. Ask HR to reset your two-factor.');
    fail((await auth().mfa.challengeAndVerify({ factorId: factor.id, code })).error);
  },
  enrolTotp: async (): Promise<TotpEnrolment> => {
    // an abandoned earlier attempt leaves an unverified factor behind; clear it first
    const { data: existing } = await auth().mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.factor_type === 'totp' && f.status !== 'verified') await auth().mfa.unenroll({ factorId: f.id });
    const { data, error } = await auth().mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
    fail(error);
    return { factorId: data!.id, secret: data!.totp.secret, uri: data!.totp.uri, qrCode: data!.totp.qr_code };
  },
  confirmTotp: async (factorId: string, code: string) => {
    fail((await auth().mfa.challengeAndVerify({ factorId, code })).error);
    return post<{ mfaEnabled: boolean }>(E.auth.mfaSync);
  },
  /** Proves the current code again, then removes the factor. */
  disableTotp: async (code: string) => {
    const { data } = await auth().mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === 'verified');
    if (factor) {
      fail((await auth().mfa.challengeAndVerify({ factorId: factor.id, code })).error);
      fail((await auth().mfa.unenroll({ factorId: factor.id })).error);
    }
    return post<{ mfaEnabled: boolean }>(E.auth.mfaSync);
  },

  // ---- JantaHR API ----
  me: () => get<SessionUser>(E.auth.me),
  provision: (company: CompanyDetails) => post<SessionUser>(E.auth.provision, company),
  changePassword: (currentPassword: string, newPassword: string) => post<{ message: string }>(E.auth.changePassword, { currentPassword, newPassword }),
  /** After an email link: set a password without the old one (the API checks the session came from the link). */
  setPassword: (newPassword: string) => post<Ok>(E.auth.setPassword, { newPassword }),
};
