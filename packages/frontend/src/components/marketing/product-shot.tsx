import Image from 'next/image';
import { cn } from '@/lib/utils';

/** A real screenshot of the product resting on the tile: the one place the system shadow appears (rule 8). */
export function ProductShot({ src, alt, width, height, priority, className }: { src: string; alt: string; width: number; height: number; priority?: boolean; className?: string }) {
  // above-the-fold (priority) shots are never scroll-revealed: they must be fully visible on load
  return (
    <div className={cn('mx-auto', !priority && 'reveal', className)}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes="(max-width: 1024px) 100vw, 1024px"
        className="h-auto w-full rounded-lg shadow-product" />
    </div>
  );
}
