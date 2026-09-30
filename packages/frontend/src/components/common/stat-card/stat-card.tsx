import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Figure-first tile: large number, caption label. Alerts colour the figure; nothing else is decorated. */
const VALUE = { default: '', success: '', info: '', warning: 'text-warning', destructive: 'text-destructive' } as const;

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', onClick }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: keyof typeof VALUE; onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  // A zero is not an alert: "Absent 0" stays ink.
  const alert = value !== 0 && value !== '0';
  return (
    <Comp onClick={onClick} className={cn('flex min-w-0 flex-col items-start justify-start rounded-lg border bg-card px-5 py-4 text-left', onClick && 'transition-transform active:scale-[0.95] hover:border-foreground/20')}>
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}{label}</p>
      <p className={cn('mt-1 text-display-sm font-semibold tabular', alert && VALUE[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-fine text-muted-foreground">{hint}</p>}
    </Comp>
  );
}
