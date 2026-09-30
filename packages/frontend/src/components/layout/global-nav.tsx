'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BrandMark } from '@/components/auth/brand-mark';
import { GlobalSearch } from '@/components/layout/global-search';
import { locate, navFor } from '@/components/layout/nav.constants';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';
import { useAuth } from '@/hooks/auth/use-auth';
import { cn } from '@/lib/utils';

/** Reference `global-nav`: black, 44px, 12px links, quiet; collapses to brand + menu below 834px. */
export function GlobalNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const sections = navFor(user);
  const { section: current } = locate(pathname, user);
  const [searching, setSearching] = React.useState(false);
  const [menu, setMenu] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching((s) => !s); }
      if (e.key === 'Escape') setSearching(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  React.useEffect(() => { setSearching(false); setMenu(false); }, [pathname]);

  return (
    <>
      <nav aria-label="Sections" className="no-print sticky top-0 z-40 bg-nav text-nav-foreground">
        <div className="mx-auto flex h-nav max-w-[1440px] items-center gap-6 px-4 lg:px-6">
          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger asChild>
              <button className="-ml-1 rounded-sm p-1.5 text-white/80 hover:text-white min-[834px]:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto border-0 bg-nav p-0 text-white">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="px-6 pb-10 pt-6">
                <BrandMark light />
                {sections.map((s) => (
                  <div key={s.key} className="mt-7">
                    <p className="text-fine text-white/55">{s.label}</p>
                    <ul className="mt-1">{s.items.map((i) => <li key={i.href}><Link href={i.href} className="block py-1.5 text-dense-link text-white/90 hover:text-white">{i.label}</Link></li>)}</ul>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" aria-label="JantaHR home" className="shrink-0"><BrandMark light compact className="min-[834px]:hidden" /><BrandMark light className="hidden min-[834px]:inline-flex" /></Link>

          <ul className="hidden flex-1 items-center justify-center gap-7 min-[834px]:flex">
            {sections.map((s) => {
              const active = current?.key === s.key;
              return (
                <li key={s.key}>
                  <Link href={s.items[0].href} aria-current={active ? 'true' : undefined}
                    className={cn('text-fine transition-colors', active ? 'text-white' : 'text-white/70 hover:text-white')}>{s.label}</Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-1 min-[834px]:ml-0">
            <button onClick={() => setSearching((s) => !s)} aria-label="Search employees (⌘K)" aria-expanded={searching}
              className="rounded-sm p-2 text-white/80 hover:text-white">{searching ? <X className="h-[17px] w-[17px]" /> : <Search className="h-[17px] w-[17px]" />}</button>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </nav>
      {searching && (
        <div className="fixed inset-x-0 top-nav z-30 border-b border-white/10 bg-nav/95 pb-8 pt-4 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl px-4"><GlobalSearch autoFocus onDone={() => setSearching(false)} /></div>
        </div>
      )}
    </>
  );
}
