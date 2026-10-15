'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { SHOTS, srcSetOf, type ShotName } from './shots';

const TOUR: { value: ShotName; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'mobile', label: 'Mobile' },
];

/**
 * Hero product tour: a segmented control over one framed screenshot (Radix Tabs: arrow keys move between tabs).
 * The first image is the page's LCP image and loads eagerly; the other three are requested only once the page has
 * loaded or the visitor reaches for the tabs, then cross-fade in 150 ms (no fade under reduced motion).
 */
export function ProductTour() {
  const [value, setValue] = React.useState<ShotName>('overview');
  const [warm, setWarm] = React.useState(false);

  React.useEffect(() => {
    const go = () => setWarm(true);
    if (document.readyState === 'complete') { const t = setTimeout(go, 1500); return () => clearTimeout(t); }
    const onLoad = () => setTimeout(go, 1500);
    window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return (
    <TabsPrimitive.Root value={value} onValueChange={(v) => { setWarm(true); setValue(v as ShotName); }} className="mt-12 sm:mt-14">
      <div className="flex justify-center" onPointerEnter={() => setWarm(true)} onFocus={() => setWarm(true)}>
        <TabsList aria-label="Product tour">
          {TOUR.map((t) => <TabsTrigger key={t.value} value={t.value} className="h-9 px-4 sm:px-5">{t.label}</TabsTrigger>)}
        </TabsList>
      </div>
      <div className="relative mx-auto mt-6 aspect-[16/10] max-w-[1024px] overflow-hidden rounded-lg bg-card shadow-product">
        {TOUR.map((t, i) => {
          const s = SHOTS[t.value];
          const active = value === t.value;
          const phone = t.value === 'mobile';
          return (
            <TabsPrimitive.Content key={t.value} value={t.value} forceMount tabIndex={active ? 0 : -1} aria-hidden={!active}
              className={cn('absolute inset-0 transition-opacity duration-150 ease-out focus-visible:outline-none motion-reduce:transition-none',
                active ? 'opacity-100' : 'pointer-events-none opacity-0', phone && 'flex items-center justify-center bg-tile-2')}>
              {(i === 0 || warm) && (
                // eslint-disable-next-line @next/next/no-img-element -- srcset by hand: next/image runs unoptimised here
                <img src={s.src} srcSet={srcSetOf(s)} alt={s.alt} width={s.width} height={s.height}
                  sizes={phone ? '(max-width: 1024px) 31vw, 320px' : '(max-width: 1024px) 100vw, 1024px'}
                  loading={i === 0 ? 'eager' : 'lazy'} decoding={i === 0 ? 'sync' : 'async'} {...(i === 0 ? { fetchPriority: 'high' as const } : {})}
                  className={phone ? 'h-[92%] w-auto rounded-lg' : 'h-full w-full object-cover object-top'} />
              )}
            </TabsPrimitive.Content>
          );
        })}
      </div>
    </TabsPrimitive.Root>
  );
}
