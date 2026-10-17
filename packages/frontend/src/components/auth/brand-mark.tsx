import { cn } from '@/lib/utils';

/** The J-HR mark (public/icon.svg): a heavy J and a compact HR, white and ice on a cobalt tile. */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={cn('h-6 w-6 shrink-0', className)} aria-hidden>
      <rect width="1024" height="1024" rx="224" fill="#2350E8" />
      <g transform="translate(512 518) scale(0.72) translate(-534 -518)" fill="none">
        <path d="M478 252 V598 A124 124 0 0 1 230 598 V586" stroke="#FFFFFF" strokeWidth="124" />
        <path d="M586 252 V452 M720 252 V452 M586 352 H720 M770 452 V275 H836 A52 52 0 0 1 836 379 H770 M818 379 L880 452" stroke="#A9E7FF" strokeWidth="46" />
      </g>
    </svg>
  );
}

/** Wordmark in the product type. `light` for the black global nav and dark tiles. */
export function BrandMark({ light, compact, className }: { light?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandIcon />
      {!compact && <span className={cn('text-body-strong', light ? 'text-white' : 'text-foreground')}>JantaHR</span>}
    </span>
  );
}
