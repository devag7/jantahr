'use client';
import * as React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common/field';
import { Spinner } from '@/components/common/states';
import { useMagicLink } from '@/hooks/auth/use-login';
import { errorMessage } from '@/lib/api/client';
import { authService } from '@/services/auth/auth.service';

/** Other Supabase Auth sign-in methods: Google (when enabled in the project) and a one-time email link. */
export function SupabaseSignIn() {
  const magic = useMagicLink();
  const [google, setGoogle] = React.useState(false);
  const [mode, setMode] = React.useState<'idle' | 'email' | 'sent'>('idle');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // show Google only when the provider is switched on in the Supabase project
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } })
      .then((r) => r.json()).then((s) => setGoogle(!!s?.external?.google)).catch(() => undefined);
  }, []);

  const withGoogle = () => { setError(null); authService.signInWithGoogle().catch((e) => setError(errorMessage(e))); };
  const sendLink = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    magic.mutate(email.trim(), { onSuccess: () => setMode('sent'), onError: (e) => setError(errorMessage(e)) });
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-fine text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <div className="mt-5 space-y-3">
        {google && <Button type="button" variant="outline" className="w-full" onClick={withGoogle}>Continue with Google</Button>}
        {mode === 'idle' && <Button type="button" variant="outline" className="w-full" onClick={() => setMode('email')}><Mail className="h-4 w-4" />Email me a sign-in link</Button>}
        {mode === 'email' && (
          <form onSubmit={sendLink} className="space-y-3">
            <Field label="Work email" htmlFor="link-email"><Input id="link-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Button type="submit" className="w-full" disabled={magic.isPending}>{magic.isPending && <Spinner />}Send link</Button>
          </form>
        )}
        {mode === 'sent' && <p role="status" className="rounded-md bg-muted px-4 py-3 text-caption">If {email} has a JantaHR account, a sign-in link is on its way. It works once and expires in an hour.</p>}
        {error && <p role="alert" className="text-fine text-destructive">{error}</p>}
      </div>
    </div>
  );
}
