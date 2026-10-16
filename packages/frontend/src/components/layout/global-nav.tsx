'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { BrandMark } from '@/components/auth/brand-mark';
import { GlobalSearch } from '@/components/layout/global-search';
import { locate, navFor } from '@/components/layout/nav.constants';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';
import { useAuth } from '@/hooks/auth/use-auth';
import { cn } from '@/lib/utils';

/**
 * Reference `global-nav`: black, 44px, 12px links, quiet. Below 834px the sections move to the tab bar and the menu
 * behind it (`tab-bar.tsx`), leaving brand, search, notifications and account, each a 44px target (rule 11).
 */
export function GlobalNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const sections = navFor(user);
  const { section: current } = locate(pathname, user);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching((s) => !s); }
      if (e.key === 'Escape') setSearching(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  React.useEffect(() => { setSearching(false); }, [pathname]);

  return (
    <>
      <nav aria-label="Sections" className="no-print sticky top-0 z-40 bg-nav pt-[env(safe-area-inset-top)] text-nav-foreground">
        <div className="mx-auto flex h-nav max-w-[1440px] items-center gap-6 px-4 lg:px-6">
          <Link href="/dashboard" className="-ml-2 flex h-11 min-w-11 shrink-0 items-center px-2 min-[834px]:ml-0 min-[834px]:h-auto min-[834px]:px-0"><span aria-hidden className="contents"><BrandMark light compact className="min-[834px]:hidden" /><BrandMark light className="hidden min-[834px]:inline-flex" /></span><span className="sr-only">JantaHR home</span></Link>

          <ul className="hidden flex-1 items-center justify-center gap-7 min-[834px]:flex">
            {sections.map((s) => {
              const active = current?.key === s.key;
              return (
                <li key={s.key} data-tour={`nav-${s.key}`}>
                  <Link href={s.items[0].href} aria-current={active ? 'true' : undefined}
                    className={cn('text-fine transition-colors', active ? 'text-white' : 'text-white/70 hover:text-white')}>{s.label}</Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-1 min-[834px]:ml-0">
            <button onClick={() => setSearching((s) => !s)} aria-label="Search employees (⌘K)" aria-expanded={searching} data-tour="search"
              className="flex h-11 w-11 items-center justify-center rounded-sm text-white/80 hover:text-white min-[834px]:h-auto min-[834px]:w-auto min-[834px]:p-2">{searching ? <X className="h-[17px] w-[17px]" /> : <Search className="h-[17px] w-[17px]" />}</button>
            <span data-tour="notifications" className="inline-flex"><NotificationBell /></span>
            <span data-tour="account" className="inline-flex"><UserMenu /></span>
          </div>
        </div>
      </nav>
      {searching && (
        <div className="fixed inset-x-0 top-[calc(theme(spacing.nav)+env(safe-area-inset-top))] z-30 border-b border-white/10 bg-nav/95 pb-8 pt-4 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl px-4"><GlobalSearch autoFocus onDone={() => setSearching(false)} /></div>
        </div>
      )}
    </>
  );
}
