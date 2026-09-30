'use client';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AssistantWidget } from '@/components/assistant/assistant-widget';
import { PlanGate } from '@/components/billing/plan-gate';
import { TrialBanner } from '@/components/billing/trial-banner';
import { GlobalNav } from '@/components/layout/global-nav';
import { SubNav } from '@/components/layout/sub-nav';
import { Spinner } from '@/components/common/states';
import { useAuth } from '@/hooks/auth/use-auth';
import { ROUTES } from '@/lib/constants';

/** Authenticated shell: black global nav, frosted sub-nav, Parchment canvas. Redirects anonymous users to sign-in. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuth();

  React.useEffect(() => {
    // a two-factor step or an unlinked sign-in is finished on the sign-in page
    if (status === 'anonymous' || status === 'mfa' || status === 'no-account') router.replace(`${ROUTES.LOGIN}?next=${encodeURIComponent(pathname)}`);
    else if (status === 'authenticated' && user?.mustChangePassword && pathname !== ROUTES.CHANGE_PASSWORD) router.replace(ROUTES.CHANGE_PASSWORD);
  }, [status, user, pathname, router]);

  if (status !== 'authenticated' || !user) {
    return <div className="flex min-h-[100dvh] items-center justify-center"><Spinner className="h-6 w-6 text-muted-foreground" /></div>;
  }
  return (
    <div className="min-h-[100dvh]">
      <GlobalNav />
      <SubNav />
      <TrialBanner />
      <main className="mx-auto max-w-[1440px] px-4 pb-24 pt-8 lg:px-6"><PlanGate>{children}</PlanGate></main>
      <AssistantWidget />
    </div>
  );
}
