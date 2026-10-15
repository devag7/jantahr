import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label above, helper text below, error below that (skill 4.6). */
export function Field({ label, htmlFor, error, hint, required, className, children, errorId, hintId }: {
  label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode;
  /** ids for aria-describedby on the control */
  errorId?: string; hintId?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor} className="text-caption font-semibold">{label}{required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}</Label>
      {children}
      {hint && !error && <p id={hintId} className="text-fine text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-fine text-destructive">{error}</p>}
    </div>
  );
}

export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return <div className={cn('grid gap-5', cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>{children}</div>;
}

/**
 * Save row for long forms: sticks to the bottom of the screen while the form is longer than the viewport, so the
 * action is always in reach. Frosted like the other floating bars (rule 8), with a hairline instead of a shadow.
 */
export function SaveBar({ children }: { children: React.ReactNode }) {
  return (
    // right padding keeps the buttons clear of the floating Help button (bottom-right, 44px on phones, labelled from 640px)
    <div className="frosted sticky bottom-0 z-20 -mx-4 flex justify-end gap-2 border-t py-3 pl-4 pr-[4.25rem] sm:pr-32 lg:-mx-6 lg:pl-6">{children}</div>
  );
}
