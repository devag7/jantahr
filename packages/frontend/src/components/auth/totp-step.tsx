'use client';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/common/field';
import { AuthHeading, FormError, SubmitButton } from '@/components/auth/auth-form';
import { useVerifyTotp } from '@/hooks/auth/use-login';
import { errorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth/auth-store';

/** Second step for accounts with two-factor: steps the Supabase session up to AAL2. */
export function TotpStep({ onVerified }: { onVerified?: () => void }) {
  const verify = useVerifyTotp();
  const logout = useAuthStore((s) => s.logout);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  return (
    <>
      <AuthHeading title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app." />
      <form className="space-y-5 rounded-lg border bg-card p-7" onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        verify.mutate(code, { onSuccess: () => onVerified?.(), onError: (err) => { setError(errorMessage(err)); setCode(''); } });
      }}>
        <FormError message={error} />
        <Field label="Authentication code" htmlFor="mfa"><Input id="mfa" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="text-center tracking-[0.5em]" /></Field>
        <SubmitButton loading={verify.isPending} disabled={code.length !== 6}>Verify</SubmitButton>
      </form>
      <Button variant="link" className="mt-4 w-full" onClick={() => void logout()}>Sign in with a different account</Button>
    </>
  );
}
