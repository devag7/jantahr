'use client';
import * as React from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common/field';
import { AuthHeading, FormError, SubmitButton } from '@/components/auth/auth-form';
import { useForgotPassword } from '@/hooks/auth/use-login';
import { errorMessage } from '@/lib/api/client';

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  if (forgot.isSuccess) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto mb-4 h-10 w-10 text-success" />
        <AuthHeading title="Check your inbox" subtitle="If that email has an account, a link to choose a new password is on its way. It expires in an hour." />
        <Link href="/login" className="text-caption font-semibold text-primary hover:underline">Back to sign in</Link>
      </div>
    );
  }
  return (
    <>
      <AuthHeading title="Forgot your password?" subtitle="Enter your work email and we will send you a link to choose a new one." />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); forgot.mutate(email.trim(), { onError: (err) => setError(errorMessage(err)) }); }} className="space-y-4">
        <FormError message={error} />
        <Field label="Work email" htmlFor="email"><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <SubmitButton loading={forgot.isPending}>Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-caption"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </>
  );
}
