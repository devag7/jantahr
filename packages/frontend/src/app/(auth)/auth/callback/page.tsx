'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthHeading, FormError } from '@/components/auth/auth-form';
import { TotpStep } from '@/components/auth/totp-step';
import { Spinner } from '@/components/common/states';
import { errorMessage } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { authService, EMAIL_LINK_TYPES, type EmailLinkType } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth/auth-store';

/**
 * Return point for Supabase Auth emails and Google. Email links return the session in the URL fragment, or a token hash
 * when the project's email templates use one; both work in any browser. Google returns an ID token in the fragment
 * (or, self-hosted, a PKCE code, as older emails do). Either way a session is established, then the page either continues to
 * `next` (the password reset form) or resolves the JantaHR account like a normal sign-in (creating the workspace a
 * new owner started before confirming their email).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [otherBrowser, setOtherBrowser] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    // emailed links return their result in the fragment (#access_token=… or #error_description=…)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Google answers #error=access_denied when the person backs out of its account chooser: back to sign in, no error
    if (hash.get('error') && hash.get('state')) {
      if (hash.get('error') === 'access_denied') router.replace(ROUTES.LOGIN);
      else setError(`Google sign-in did not complete (${hash.get('error')}). Please try again.`);
      return;
    }
    const fail = url.searchParams.get('error_description') || hash.get('error_description');
    if (fail) { setError(/expired|invalid/i.test(fail) ? 'This link has expired or was already used. Request a new one.' : fail); return; }
    const next = url.searchParams.get('next');
    (async () => {
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const type = url.searchParams.get('type') as EmailLinkType | null;
      const accessToken = hash.get('access_token'), refreshToken = hash.get('refresh_token'), idToken = hash.get('id_token');
      if (idToken) {
        window.history.replaceState(null, '', url.pathname);
        await authService.finishGoogle(idToken, hash.get('state'));
      } else if (accessToken && refreshToken) {
        await authService.adoptSession(accessToken, refreshToken);
        // the tokens are in the address bar: drop them from the URL and the history entry
        window.history.replaceState(null, '', url.pathname + url.search);
      } else if (tokenHash && type && EMAIL_LINK_TYPES.includes(type)) await authService.verifyEmailLink(tokenHash, type);
      else if (code) {
        try {
          await authService.exchangeCode(code);
        } catch (e) {
          // A `code` link only completes in the browser that started it. Opened elsewhere (a mail app, another
          // device) it fails here, but Supabase has already confirmed the address by then.
          if (/code verifier/i.test(errorMessage(e))) { setOtherBrowser(true); return; }
          throw e;
        }
      }
      if (!(await authService.hasSession())) throw new Error('This link is invalid or has expired. Request a new one.');
      if (next === '/reset-password' || type === 'recovery' || hash.get('type') === 'recovery') { router.replace('/reset-password'); return; }
      await bootstrap();
      setReady(true);
    })().catch((e) => setError(errorMessage(e)));
  }, [bootstrap, router]);

  React.useEffect(() => {
    if (!ready) return;
    if (status === 'authenticated' && user) router.replace(user.mustChangePassword ? ROUTES.CHANGE_PASSWORD : ROUTES.DASHBOARD);
    else if (status === 'no-account' || status === 'anonymous') router.replace(ROUTES.LOGIN);
  }, [ready, status, user, router]);

  if (otherBrowser) {
    return (
      <>
        <AuthHeading title="Your email is confirmed" subtitle="This link was opened in a different browser from the one you started in, so we could not sign you in automatically. Sign in with your email and password to continue." />
        <p className="mt-6"><Link href={ROUTES.LOGIN} className="inline-flex h-11 items-center rounded-full bg-primary px-[22px] text-body text-primary-foreground transition-transform active:scale-[0.95]">Sign in</Link></p>
      </>
    );
  }
  if (error) {
    return (
      <>
        <AuthHeading title="Sign-in did not complete" />
        <FormError message={error} />
        <p className="mt-6 text-caption"><Link href={ROUTES.LOGIN} className="text-primary hover:underline">Back to sign in</Link></p>
      </>
    );
  }
  if (ready && status === 'mfa') return <TotpStep />;
  return <div className="flex items-center gap-3 text-body text-muted-foreground"><Spinner />Signing you in</div>;
}
