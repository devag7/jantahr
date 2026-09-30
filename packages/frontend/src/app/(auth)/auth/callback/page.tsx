'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthHeading, FormError } from '@/components/auth/auth-form';
import { TotpStep } from '@/components/auth/totp-step';
import { Spinner } from '@/components/common/states';
import { errorMessage } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { authService } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth/auth-store';

/**
 * Return point for Supabase Auth emails and Google: exchanges the PKCE code for a session, then either continues to
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
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const fail = url.searchParams.get('error_description');
    if (fail) { setError(fail); return; }
    const next = url.searchParams.get('next');
    (async () => {
      const code = url.searchParams.get('code');
      if (code) await authService.exchangeCode(code);
      if (!(await authService.hasSession())) throw new Error('This link is invalid or has expired. Request a new one.');
      if (next === '/reset-password') { router.replace(next); return; }
      await bootstrap();
      setReady(true);
    })().catch((e) => setError(errorMessage(e)));
  }, [bootstrap, router]);

  React.useEffect(() => {
    if (!ready) return;
    if (status === 'authenticated' && user) router.replace(user.mustChangePassword ? ROUTES.CHANGE_PASSWORD : ROUTES.DASHBOARD);
    else if (status === 'no-account' || status === 'anonymous') router.replace(ROUTES.LOGIN);
  }, [ready, status, user, router]);

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
