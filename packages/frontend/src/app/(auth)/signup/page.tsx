'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Field, FormGrid } from '@/components/common/field';
import { AuthHeading, FormError, PASSWORD_HINT, PasswordInput, SubmitButton, validPassword } from '@/components/auth/auth-form';
import { useSignup } from '@/hooks/auth/use-login';
import { useStates } from '@/hooks/org/use-org';
import { errorMessage } from '@/lib/api/client';
import { INDIAN_STATES } from '@/lib/india';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth/auth-store';

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const states = useStates();
  const [f, setF] = React.useState({ companyName: '', state: 'Maharashtra', firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validPassword(f.password)) return setError(PASSWORD_HINT);
    setError(null);
    // arriving from the pricing page with ?plan=: land on Billing with that plan in mind; the trial runs meanwhile
    const plan = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null;
    signup.mutate({ ...f, email: f.email.trim() }, {
      onSuccess: (r) => {
        if (r === 'confirm-email') setConfirm(true);
        else if (r === 'authenticated') router.replace(plan === 'STANDARD' || plan === 'PROFESSIONAL' ? `/hr/billing?plan=${plan}` : ROUTES.DASHBOARD);
        else setError(useAuthStore.getState().notice ?? 'The workspace could not be created. Try signing in.');
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };

  if (confirm) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto mb-4 h-10 w-10 text-success" />
        <AuthHeading title="Confirm your email" subtitle={`We sent a link to ${f.email}. Open it on this device and your workspace, ${f.companyName}, is created straight away.`} />
        <Link href="/login" className="text-caption font-semibold text-primary hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Create your workspace" subtitle="Set up your company: leave types, salary structure and holidays are pre-configured for India." />
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <Field label="Company name" htmlFor="company" required><Input id="company" required value={f.companyName} onChange={set('companyName')} /></Field>
        <Field label="State of registration" htmlFor="state" hint="Used for professional tax and labour welfare fund">
          <NativeSelect id="state" value={f.state} onChange={set('state')}>{(states.data ?? INDIAN_STATES).map((s) => <option key={s}>{s}</option>)}</NativeSelect>
        </Field>
        <FormGrid>
          <Field label="First name" htmlFor="fn" required><Input id="fn" required value={f.firstName} onChange={set('firstName')} /></Field>
          <Field label="Last name" htmlFor="ln"><Input id="ln" value={f.lastName} onChange={set('lastName')} /></Field>
        </FormGrid>
        <Field label="Work email" htmlFor="email" required><Input id="email" type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" htmlFor="pw" hint={PASSWORD_HINT} required><PasswordInput id="pw" autoComplete="new-password" required value={f.password} onChange={set('password')} /></Field>
        <SubmitButton loading={signup.isPending}>Create workspace</SubmitButton>
      </form>
      <p className="mt-6 text-center text-caption text-muted-foreground">Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
    </>
  );
}
