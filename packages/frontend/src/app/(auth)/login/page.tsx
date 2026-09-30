'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common/field';
import { AuthHeading, FormError, PasswordInput, SubmitButton } from '@/components/auth/auth-form';
import { DEMO_LOGINS } from '@/components/auth/demo-logins.constants';
import { SupabaseSignIn } from '@/components/auth/supabase-sign-in';
import { TotpStep } from '@/components/auth/totp-step';
import { useLogin } from '@/hooks/auth/use-login';
import { useAuth } from '@/hooks/auth/use-auth';
import { errorMessage } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth/auth-store';

const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, user } = useAuth();
  const notice = useAuthStore((s) => s.notice);
  const logout = useAuthStore((s) => s.logout);
  const login = useLogin();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const next = params.get('next');
  React.useEffect(() => {
    if (status === 'authenticated' && user) router.replace(user.mustChangePassword ? ROUTES.CHANGE_PASSWORD : next && next.startsWith('/') ? next : ROUTES.DASHBOARD);
  }, [status, user, router, next]);

  if (status === 'mfa') return <TotpStep />;
  if (status === 'no-account') {
    return (
      <>
        <AuthHeading title="No JantaHR account yet" subtitle={notice ?? 'This sign-in is not linked to a JantaHR account.'} />
        <div className="space-y-3">
          <Button className="w-full" onClick={() => router.push('/signup')}>Create a workspace</Button>
          <Button variant="outline" className="w-full" onClick={() => void logout()}>Use a different account</Button>
        </div>
      </>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate({ email: email.trim(), password }, { onError: (err) => setError(errorMessage(err)) });
  };

  return (
    <>
      <AuthHeading title="Sign in" subtitle="Sign in to your JantaHR workspace." />
      <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-7" noValidate>
        <FormError message={error ?? notice} />
        <Field label="Work email" htmlFor="email"><Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
        <Field label="Password" htmlFor="password"><PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="flex justify-end text-caption"><Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link></div>
        <SubmitButton loading={login.isPending || status === 'loading'}>Sign in</SubmitButton>
      </form>
      <SupabaseSignIn />
      <p className="mt-6 text-center text-caption text-muted-foreground">New company? <Link href="/signup" className="font-semibold text-primary hover:underline">Create a workspace</Link></p>
      {SHOW_DEMO && (
        <div className="mt-8 rounded-lg bg-muted p-4">
          <p className="mb-2 text-fine font-semibold text-muted-foreground">Demo accounts (development only)</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_LOGINS.map((d) => (
              <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword(d.password); }} className="rounded-full border bg-card px-3 py-1 text-fine hover:border-foreground/30">{d.label}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
