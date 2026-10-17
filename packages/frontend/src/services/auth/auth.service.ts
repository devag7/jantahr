import type { AuthError } from '@supabase/supabase-js';
import { get, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import { createClient, createEmailFlowClient } from '@/lib/supabase/client';
import type { CompanyDetails, SessionUser, SignupInput, TotpEnrolment } from '@/types/auth';
import type { Ok } from '@/types/common';

/** Where a new workspace's details wait (Supabase user metadata) while the owner confirms their email. */
export const SIGNUP_METADATA_KEY = 'jantahr_signup';

const auth = () => createClient().auth;
/** For requests that make Supabase send an email: their links must work in any browser (see createEmailFlowClient). */
const mailer = () => createEmailFlowClient().auth;
// No query string: Supabase only redirects to URLs on its allow-list, and `…/auth/callback?next=…` does not match the
// listed `…/auth/callback`, so the user would be dropped on the site's home page. The callback reads the link type instead.
const callbackUrl = () => `${window.location.origin}/auth/callback`;

/**
 * Google sign-in on the site's own address. With a Google client ID (cloud edition) the browser goes straight to
 * Google and back to /auth/callback with an ID token that Supabase checks (signInWithIdToken), so Google's screen
 * names this site, and the app name once Google has verified the branding, instead of the Supabase project address.
 * Without one (self-hosted) Supabase runs the usual redirect flow.
 */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_PENDING = 'jantahr:google-sign-in';
const GOOGLE_PENDING_MS = 15 * 60_000;
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, '0')).join('');

/** Kinds of emailed link Supabase Auth sends (the `type` query parameter of our email templates). */
export const EMAIL_LINK_TYPES = ['email', 'signup', 'magiclink', 'recovery', 'invite', 'email_change'] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

/** Supabase Auth errors in the words the sign-in screens use. */
function fail(error: AuthError | null): void {
  if (!error) return;
  const byCode: Record<string, string> = {
    invalid_credentials: 'Incorrect email or password.',
    email_not_confirmed: 'Confirm your email address first: open the link we sent you.',
    user_banned: 'Your account is disabled. Contact your HR team.',
    mfa_verification_failed: 'That code did not match. Check the time on your phone and try again.',
    over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
    over_email_send_rate_limit: 'Too many emails were sent in the last hour. Try again later.',
    // Supabase's built-in sender only delivers to the project team's own addresses; a custom SMTP server lifts this
    email_address_not_authorized: 'We cannot send email to this address yet: email delivery for this site is still being set up. Please contact us.',
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
    const { error } = await mailer().signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false } });
    // an unknown address answers "signups not allowed"; report success either way so accounts cannot be probed
    if (error?.code !== 'otp_disabled' && !/signups not allowed/i.test(error?.message ?? '')) fail(error);
  },
  signInWithGoogle: async () => {
    if (!GOOGLE_CLIENT_ID) return fail((await auth().signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } })).error);
    // Google signs the hash of the nonce into the ID token and Supabase checks it against the nonce itself, so a token
    // taken from another sign-in cannot be replayed; the state ties the answer to this browser.
    const nonce = randomToken(), state = randomToken();
    localStorage.setItem(GOOGLE_PENDING, JSON.stringify({ nonce, state, at: Date.now() }));
    const q = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(), response_type: 'id_token', scope: 'openid email profile', nonce: await sha256Hex(nonce), state, prompt: 'select_account' });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  },
  /** Second half of signInWithGoogle, on /auth/callback: hands Google's ID token to Supabase. */
  finishGoogle: async (idToken: string, state: string | null) => {
    let pending: { nonce?: string; state?: string; at?: number } = {};
    try { pending = JSON.parse(localStorage.getItem(GOOGLE_PENDING) ?? '{}'); } catch { /* treated as missing */ }
    localStorage.removeItem(GOOGLE_PENDING);
    if (!pending.nonce || !state || pending.state !== state || Date.now() - (pending.at ?? 0) > GOOGLE_PENDING_MS) {
      throw new Error('This Google sign-in was started in another browser or took too long. Please try again.');
    }
    fail((await auth().signInWithIdToken({ provider: 'google', token: idToken, nonce: pending.nonce })).error);
  },
  sendPasswordReset: async (email: string) => fail((await mailer().resetPasswordForEmail(email, { redirectTo: callbackUrl() })).error),
  /** Creates the Supabase account; returns whether the email must be confirmed before the workspace can be created. */
  signUp: async ({ email, password, ...company }: SignupInput) => {
    const { data, error } = await mailer().signUp({ email, password, options: { data: { [SIGNUP_METADATA_KEY]: company }, emailRedirectTo: callbackUrl() } });
    fail(error);
    // with email confirmation switched off Supabase signs the user in at once: hand that session to the main client
    if (data.session) fail((await auth().setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })).error);
    return { needsConfirmation: !data.session };
  },
  exchangeCode: async (code: string) => fail((await auth().exchangeCodeForSession(code)).error),
  /** Signs in from an emailed link that returned the session in the URL fragment (the links createEmailFlowClient asks for). */
  adoptSession: async (accessToken: string, refreshToken: string) => fail((await auth().setSession({ access_token: accessToken, refresh_token: refreshToken })).error),
  /**
   * Signs in from an emailed link that carries a token hash. Unlike the PKCE `code` links, these work in any browser or
   * device, which matters because people open mail in a different app from the one they signed up in.
   */
  verifyEmailLink: async (tokenHash: string, type: EmailLinkType) => fail((await auth().verifyOtp({ token_hash: tokenHash, type })).error),
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
