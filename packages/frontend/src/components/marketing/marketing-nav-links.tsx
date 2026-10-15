'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { BrandMark } from '@/components/auth/brand-mark';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/** The global bar's links; `wide` ones only show from 640px (the menu has them all on phones). */
const LINKS: { label: string; href: string; wide?: boolean }[] = [
  { label: 'Payroll', href: '/#payroll' },
  { label: 'Compliance', href: '/#compliance', wide: true },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Self-hosting', href: '/self-hosting', wide: true },
  { label: 'Sign in', href: '/login' },
];
/** Pages reached from the footer on desktop, listed in the phone menu as well. */
const MORE = [{ label: 'Developers', href: '/developers' }, { label: 'About', href: '/about' }, { label: 'Contact us', href: '/contact' }];

// an in-page anchor (/#payroll) is never "the current page"
const isCurrent = (pathname: string, href: string) => !href.includes('#') && (pathname === href || pathname.startsWith(`${href}/`));

/** Links in the black marketing bar, with the current page marked, and a menu sheet on phones. */
export function MarketingNavLinks() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="flex items-center gap-1 sm:gap-0">
      <ul className="flex items-center gap-5 text-nav-link sm:gap-8">
        {LINKS.map((l) => {
          const current = isCurrent(pathname, l.href);
          return (
            <li key={l.href} className={cn(l.wide && 'hidden sm:block')}>
              <Link href={l.href} aria-current={current ? 'page' : undefined}
                className={cn('transition-colors', current ? 'font-semibold text-white' : 'text-white/80 hover:text-white')}>{l.label}</Link>
            </li>
          );
        })}
      </ul>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="-mr-2 ml-2 flex h-11 w-11 items-center justify-center rounded-sm text-white/80 hover:text-white sm:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 max-w-[85vw] overflow-y-auto border-0 bg-nav p-0 text-white [&>button]:h-11 [&>button]:w-11 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:items-center [&>button]:justify-center">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="px-6 pb-10 pt-5">
            <BrandMark light />
            <ul className="mt-8">
              {[...LINKS, ...MORE].map((l) => {
                const current = isCurrent(pathname, l.href);
                return (
                  <li key={l.href}>
                    <Link href={l.href} onClick={() => setOpen(false)} aria-current={current ? 'page' : undefined}
                      className={cn('flex min-h-[44px] items-center text-body', current ? 'font-semibold text-white' : 'text-white/85 hover:text-white')}>{l.label}</Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/signup" onClick={() => setOpen(false)} className="mt-8 inline-flex h-11 items-center whitespace-nowrap rounded-full bg-primary px-[22px] text-body text-primary-foreground transition-transform active:scale-[0.95]">Start free trial</Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
