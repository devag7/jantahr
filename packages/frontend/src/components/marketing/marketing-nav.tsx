import Link from 'next/link';
import { BrandMark } from '@/components/auth/brand-mark';
import { MarketingNavLinks } from '@/components/marketing/marketing-nav-links';

/** Marketing chrome: black 44px global nav + frosted 52px sub-nav with the one primary CTA (reference global-nav / sub-nav-frosted). */
export function MarketingNav({ title = 'JantaHR' }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40">
      <nav aria-label="Site" className="bg-nav text-nav-foreground">
        <div className="mx-auto flex h-nav max-w-[1024px] items-center justify-between px-4">
          <Link href="/" className="flex h-11 items-center"><BrandMark light compact /><span className="sr-only">JantaHR home</span></Link>
          <MarketingNavLinks />
        </div>
      </nav>
      <div className="frosted border-b">
        <div className="mx-auto flex h-subnav max-w-[1024px] items-center justify-between gap-4 px-4">
          <p className="min-w-0 truncate text-tagline font-semibold">{title}</p>
          <Link href="/signup" className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-primary px-4 text-caption text-primary-foreground transition-transform active:scale-[0.95]">Start free trial</Link>
        </div>
      </div>
    </header>
  );
}
