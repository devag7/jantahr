'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/common/field';
import { PageHeader } from '@/components/common/page-header';
import { FormError, PASSWORD_HINT, PasswordInput, SubmitButton, validPassword } from '@/components/auth/auth-form';
import { useAuth } from '@/hooks/auth/use-auth';
import { useChangePassword } from '@/hooks/auth/use-login';
import { errorMessage } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth/auth-store';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const change = useChangePassword();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [f, setF] = React.useState({ current: '', next: '' });
  const [error, setError] = React.useState<string | null>(null);
  const forced = user?.mustChangePassword;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Change password" description={forced ? 'For your security, please set a new password before continuing.' : 'Choose a strong password you do not use elsewhere.'} />
      <Card><CardHeader><CardTitle>New password</CardTitle></CardHeader><CardContent>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          if (!validPassword(f.next)) return setError(PASSWORD_HINT);
          setError(null);
          change.mutate(f, {
            onSuccess: async () => { await refreshUser(); toast.success('Password changed. Other devices have been signed out.'); router.replace(ROUTES.DASHBOARD); },
            onError: (err) => setError(errorMessage(err)),
          });
        }}>
          <FormError message={error} />
          <Field label="Current password" htmlFor="cur"><PasswordInput id="cur" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
          <Field label="New password" htmlFor="new" hint={PASSWORD_HINT}><PasswordInput id="new" autoComplete="new-password" required value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
          <SubmitButton loading={change.isPending}>Update password</SubmitButton>
        </form>
      </CardContent></Card>
    </div>
  );
}
