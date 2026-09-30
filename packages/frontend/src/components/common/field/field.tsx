import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label above, helper text below, error below that (skill 4.6). */
export function Field({ label, htmlFor, error, hint, required, className, children }: {
  label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor} className="text-caption font-semibold">{label}{required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}</Label>
      {children}
      {hint && !error && <p className="text-fine text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-fine text-destructive">{error}</p>}
    </div>
  );
}

export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return <div className={cn('grid gap-5', cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>{children}</div>;
}
