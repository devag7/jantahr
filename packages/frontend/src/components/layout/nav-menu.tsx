'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { BrandMark } from '@/components/auth/brand-mark';
import { isNavActive, navFor } from '@/components/layout/nav.constants';
import { useAuth } from '@/hooks/auth/use-auth';
import { cn } from '@/lib/utils';

/** Every section and page, in a sheet from the left: the phone menu behind the tab bar's Menu button. */
export function NavMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const sections = navFor(user);
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 overflow-y-auto border-0 bg-nav p-0 pt-[env(safe-area-inset-top)] text-white">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6">
          <BrandMark light />
          {sections.map((s) => (
            <div key={s.key} className="mt-7">
              <p className="text-fine text-white/55">{s.label}</p>
              <ul className="mt-1">{s.items.map((i) => {
                const here = isNavActive(pathname, i.href, hrefs);
                return <li key={i.href}><Link href={i.href} aria-current={here ? 'page' : undefined} className={cn('flex min-h-[44px] items-center text-body', here ? 'font-semibold text-white' : 'text-white/85 hover:text-white')}>{i.label}</Link></li>;
              })}</ul>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
