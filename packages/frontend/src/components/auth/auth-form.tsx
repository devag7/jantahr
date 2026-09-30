'use client';
import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/common/states';

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-title font-semibold">{title}</h1>
      {subtitle && <p className="mt-2 text-body text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export const PASSWORD_HINT = 'At least 8 characters with a letter and a number';
export const validPassword = (p: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p);

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function SubmitButton({ loading, disabled, children }: { loading: boolean; disabled?: boolean; children: React.ReactNode }) {
  return <Button type="submit" className="w-full" disabled={loading || disabled}>{loading && <Spinner />}{children}</Button>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-md bg-card px-4 py-3 text-caption text-destructive">{message}</div>;
}
