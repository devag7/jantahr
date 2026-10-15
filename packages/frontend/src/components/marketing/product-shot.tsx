import { cn } from '@/lib/utils';
import { SHOTS, srcSetOf, type ShotName } from './shots';

/**
 * A real screenshot of the product resting on the tile: the one place the system shadow appears (rule 8). Served
 * through srcset, so each screen downloads the narrowest copy that is sharp at its width (`sizes`).
 */
export function ProductShot({ name, priority, sizes = '(max-width: 1024px) 100vw, 1024px', className, imgClassName }: {
  name: ShotName; priority?: boolean; sizes?: string; className?: string; imgClassName?: string;
}) {
  const s = SHOTS[name];
  return (
    // above-the-fold (priority) shots are never scroll-revealed: they must be fully visible on load
    <div className={cn('mx-auto', !priority && 'reveal', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image is unoptimised here (see next.config.mjs), so srcset is written by hand */}
      <img src={s.src} srcSet={srcSetOf(s)} sizes={sizes} alt={s.alt} width={s.width} height={s.height}
        loading={priority ? 'eager' : 'lazy'} decoding="async" {...(priority ? { fetchPriority: 'high' as const } : {})}
        className={cn('h-auto w-full rounded-lg shadow-product', imgClassName)} />
    </div>
  );
}
