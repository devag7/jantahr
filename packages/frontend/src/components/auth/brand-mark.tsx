import { cn } from '@/lib/utils';

/** Wordmark in the product type. `light` for the black global nav and dark tiles. */
export function BrandMark({ light, compact, className }: { light?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('flex h-6 w-6 items-center justify-center rounded-sm text-fine font-bold tracking-normal', light ? 'bg-white text-black' : 'bg-foreground text-background')} aria-hidden>JH</span>
      {!compact && <span className={cn('text-body-strong', light ? 'text-white' : 'text-foreground')}>JantaHR</span>}
    </span>
  );
}
