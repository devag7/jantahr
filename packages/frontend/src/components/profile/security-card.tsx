'use client';
import * as React from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { useAuth } from '@/hooks/auth/use-auth';
import { errorMessage } from '@/lib/api/client';
import { authService } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth/auth-store';
import type { TotpEnrolment } from '@/types/auth';

const codeInput = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/** Two-factor authentication with an authenticator app (Supabase Auth TOTP factors). */
export function SecurityCard() {
  const { user } = useAuth();
  const refresh = useAuthStore((s) => s.refreshUser);
  const setup = useApiMutation(() => authService.enrolTotp(), { silentError: true });
  const enable = useApiMutation((v: { factorId: string; code: string }) => authService.confirmTotp(v.factorId, v.code), { silentError: true });
  const disable = useApiMutation((code: string) => authService.disableTotp(code), { silentError: true });
  const [enrol, setEnrol] = React.useState<TotpEnrolment | null>(null);
  const [code, setCode] = React.useState('');
  const [off, setOff] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!user) return null;
  const on = user.mfaEnabled;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Two-factor authentication</CardTitle>{on ? <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" />Enabled</Badge> : <Badge variant="muted"><ShieldOff className="mr-1 h-3 w-3" />Off</Badge>}</CardHeader>
      <CardContent className="space-y-3 text-caption">
        <p className="text-muted-foreground">Add a second step at sign-in using an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password). Strongly recommended for HR and payroll admins.</p>
        {on ? <Button variant="outline" onClick={() => { setError(null); setCode(''); setOff(true); }}>Turn off two-factor</Button>
          : <Button disabled={setup.isPending} onClick={() => setup.mutate(undefined, { onSuccess: (r) => { setError(null); setCode(''); setEnrol(r); }, onError: (e) => toast.error(errorMessage(e)) })}>{setup.isPending && <Spinner className="mr-2" />}Set up two-factor</Button>}
      </CardContent>
      <Modal open={!!enrol} onOpenChange={(o) => !o && setEnrol(null)} title="Set up authenticator" description="Scan the code with your authenticator app, or type the key, then enter the 6-digit code it shows.">
        {enrol && (
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault(); setError(null);
            enable.mutate({ factorId: enrol.factorId, code }, { onSuccess: async () => { toast.success('Two-factor authentication is on'); setEnrol(null); await refresh(); }, onError: (err) => setError(errorMessage(err)) });
          }}>
            <div className="flex flex-col items-center gap-3 rounded-md bg-muted p-4 sm:flex-row sm:items-start">
              {enrol.qrCode.startsWith('data:image/svg') && <img src={enrol.qrCode} alt="QR code for your authenticator app" className="h-36 w-36 rounded-sm bg-white p-2" />}
              <div className="min-w-0"><p className="text-fine text-muted-foreground">Setup key</p><p className="mt-1 break-all font-mono text-caption font-semibold tracking-wider">{enrol.secret}</p><a href={enrol.uri} className="mt-2 inline-block text-fine text-primary hover:underline">Open in authenticator app</a></div>
            </div>
            <Field label="6-digit code" htmlFor="mc" error={error ?? undefined}><Input id="mc" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(codeInput(e.target.value))} className="text-center text-tagline tracking-[0.4em]" /></Field>
            <div className="flex justify-end"><Button type="submit" disabled={code.length !== 6 || enable.isPending}>{enable.isPending && <Spinner />}Verify and turn on</Button></div>
          </form>
        )}
      </Modal>
      <Modal open={off} onOpenChange={setOff} title="Turn off two-factor?" description="Enter a current code from your authenticator app to confirm.">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault(); setError(null);
          disable.mutate(code, { onSuccess: async () => { toast.success('Two-factor authentication is off'); setOff(false); await refresh(); }, onError: (err) => setError(errorMessage(err)) });
        }}>
          <Field label="Authenticator code" htmlFor="dc" error={error ?? undefined}><Input id="dc" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(codeInput(e.target.value))} /></Field>
          <div className="flex justify-end"><Button type="submit" variant="destructive" disabled={code.length !== 6 || disable.isPending}>{disable.isPending && <Spinner />}Turn off</Button></div>
        </form>
      </Modal>
    </Card>
  );
}
