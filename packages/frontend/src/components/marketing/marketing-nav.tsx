import Link from 'next/link';
import { BrandMark } from '@/components/auth/brand-mark';

/** Marketing chrome: black 44px global nav + frosted 52px sub-nav with the one primary CTA (reference global-nav / sub-nav-frosted). */
export function MarketingNav({ title = 'JantaHR' }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40">
      <nav aria-label="Site" className="bg-nav text-nav-foreground">
        <div className="mx-auto flex h-nav max-w-[1024px] items-center justify-between px-4">
          <Link href="/" aria-label="JantaHR home"><BrandMark light compact /></Link>
          <ul className="flex items-center gap-6 text-fine sm:gap-8">
            <li><Link href="/#payroll" className="text-white/80 hover:text-white">Payroll</Link></li>
            <li className="hidden sm:block"><Link href="/#compliance" className="text-white/80 hover:text-white">Compliance</Link></li>
            <li><Link href="/pricing" className="text-white/80 hover:text-white">Pricing</Link></li>
            <li className="hidden sm:block"><Link href="/self-hosting" className="text-white/80 hover:text-white">Self-hosting</Link></li>
            <li><Link href="/login" className="text-white/80 hover:text-white">Sign in</Link></li>
          </ul>
        </div>
      </nav>
      <div className="frosted border-b">
        <div className="mx-auto flex h-subnav max-w-[1024px] items-center justify-between px-4">
          <p className="text-tagline font-semibold">{title}</p>
          <Link href="/signup" className="inline-flex h-8 items-center rounded-full bg-primary px-4 text-caption text-primary-foreground transition-transform active:scale-[0.95]">Start free trial</Link>
        </div>
      </div>
    </header>
  );
}
