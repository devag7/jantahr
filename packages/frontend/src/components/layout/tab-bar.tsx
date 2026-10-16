'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clock, Home, Inbox, Menu, Wallet, type LucideIcon } from 'lucide-react';
import { NavMenu } from '@/components/layout/nav-menu';
import { isNavActive, navFor, tabsFor } from '@/components/layout/nav.constants';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEntitlements } from '@/hooks/billing/use-billing';
import { cn } from '@/lib/utils';

const TAB: Record<string, { label: string; icon: LucideIcon }> = {
  '/dashboard': { label: 'Home', icon: Home },
  '/approvals': { label: 'Approvals', icon: Inbox },
  '/me/attendance': { label: 'Attendance', icon: Clock },
  '/me/leave': { label: 'Leave', icon: CalendarDays },
  '/me/payslips': { label: 'Payslips', icon: Wallet },
};

const item = 'flex min-h-tabbar flex-1 flex-col items-center justify-center gap-1 text-fine transition-[transform,color] duration-150 [-webkit-tap-highlight-color:transparent] active:scale-[0.95]';

/**
 * Phone navigation (below 834px): a frosted bar at the bottom, in the thumb's reach, with four pages and the menu.
 * Icon and label on every item; the current page in Action Blue (the one accent, rule 1), the others in secondary ink (muted grey is under 4.5:1 on
 * the frosted fill). Menu is current on any page that is not a tab. Clears the home indicator.
 */
export function TabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const ent = useEntitlements();
  const [menu, setMenu] = React.useState(false);
  React.useEffect(() => { setMenu(false); }, [pathname]);

  // a page outside the company's plan is a dead end on a phone, so it gives its slot to the next one
  const tabs = tabsFor(user).filter((t) => !t.feature || !ent.data || ent.data.features.includes(t.feature) || ent.data.readOnlyFeatures.includes(t.feature)).slice(0, 4);
  const hrefs = navFor(user).flatMap((s) => s.items.map((i) => i.href));
  const onTab = tabs.some((t) => isNavActive(pathname, t.href, hrefs));

  return (
    <>
      <nav aria-label="Primary" className="no-print frosted fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] min-[834px]:hidden">
        <ul className="mx-auto flex max-w-lg">
          {tabs.map((t) => {
            const { label, icon: Icon } = TAB[t.href];
            const active = isNavActive(pathname, t.href, hrefs);
            return (
              <li key={t.href} className="flex flex-1">
                <Link href={t.href} aria-current={active ? 'page' : undefined} className={cn(item, active ? 'font-semibold text-primary' : 'text-secondary-foreground')}>
                  <Icon className="h-[22px] w-[22px]" aria-hidden />{label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button type="button" onClick={() => setMenu(true)} aria-expanded={menu} data-tour="nav-menu"
              className={cn(item, !onTab && !menu ? 'font-semibold text-primary' : 'text-secondary-foreground')}>
              <Menu className="h-[22px] w-[22px]" aria-hidden />Menu
            </button>
          </li>
        </ul>
      </nav>
      <NavMenu open={menu} onOpenChange={setMenu} />
    </>
  );
}
