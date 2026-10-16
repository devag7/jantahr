'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { isNavActive, locate, navFor } from '@/components/layout/nav.constants';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEntitlements } from '@/hooks/billing/use-billing';
import { cn } from '@/lib/utils';

/**
 * Reference `sub-nav-frosted`: Parchment at 80% with backdrop blur, 52px; section name in tagline type, pages at 14px.
 * Pinned under the global nav from 834px; on phones it scrolls away so the page keeps the room between the two bars.
 */
export function SubNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const ent = useEntitlements();
  const { section } = locate(pathname, user);
  if (!section || section.items.length < 2) return <div className="h-2" aria-hidden />;
  const hrefs = navFor(user).flatMap((s) => s.items.map((i) => i.href));
  return (
    <div className="no-print frosted z-30 border-b min-[834px]:sticky min-[834px]:top-nav">
      <div className="mx-auto flex h-subnav max-w-[1440px] items-center gap-6 px-4 lg:px-6">
        <p className="hidden shrink-0 text-tagline font-semibold sm:block">{section.label}</p>
        {/* py: the scroll area must hold each page's 44px tap area (`hit`), or it clips it */}
        <nav aria-label={section.label} data-tour="subnav" className="-mx-1 flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto py-[5px] [scrollbar-width:none] sm:justify-end">
          {section.items.map((i) => {
            const active = isNavActive(pathname, i.href, hrefs);
            const locked = !!i.feature && ent.data && !ent.data.features.includes(i.feature) && !ent.data.readOnlyFeatures.includes(i.feature);
            return (
              <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}
                className={cn('hit inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-caption transition-colors',
                  active ? 'border border-border bg-card font-semibold text-foreground' : 'border border-transparent text-foreground/80 hover:text-foreground')}>
                {i.label}{locked && <Lock className="h-3 w-3 opacity-60" aria-label="Not in your plan" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
