'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Field } from '@/components/common/field';
import { Spinner } from '@/components/common/states';
import { AuthHeading, FormError, PASSWORD_HINT, PasswordInput, SubmitButton, validPassword } from '@/components/auth/auth-form';
import { TotpStep } from '@/components/auth/totp-step';
import { useSetPassword } from '@/hooks/auth/use-login';
import { errorMessage } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { authService } from '@/services/auth/auth.service';

/** Reached from the reset email (via /auth/callback, which signs the person in with the link). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const setPw = useSetPassword();
  const [linked, setLinked] = React.useState<boolean | null>(null);
  const [needsCode, setNeedsCode] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { void authService.hasSession().then(setLinked); }, []);

  const save = () => setPw.mutate(password, {
    onSuccess: () => { toast.success('Password updated'); router.replace(ROUTES.DASHBOARD); },
    onError: (err) => {
      // accounts with two-factor confirm a code before the password can change
      if ((err as { response?: { data?: { code?: string } } }).response?.data?.code === 'MFA_REQUIRED') setNeedsCode(true);
      else setError(errorMessage(err));
    },
  });

  if (linked === null) return <div className="flex items-center gap-3 text-body text-muted-foreground"><Spinner />Checking your link</div>;
  if (!linked) {
    return (
      <>
        <AuthHeading title="Link expired" subtitle="Password links work once and expire after an hour." />
        <p className="text-center text-caption"><Link href="/forgot-password" className="font-semibold text-primary hover:underline">Send a new link</Link></p>
      </>
    );
  }
  if (needsCode) return <TotpStep onVerified={() => { setNeedsCode(false); save(); }} />;
  return (
    <>
      <AuthHeading title="Choose a new password" />
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!validPassword(password)) return setError(PASSWORD_HINT);
        setError(null);
        save();
      }} className="space-y-4">
        <FormError message={error} />
        <Field label="New password" htmlFor="pw" hint={PASSWORD_HINT}><PasswordInput id="pw" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <SubmitButton loading={setPw.isPending}>Update password</SubmitButton>
      </form>
    </>
  );
}
