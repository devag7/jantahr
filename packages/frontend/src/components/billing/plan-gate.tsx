'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { featureFor } from '@/components/layout/nav.constants';
import { useFeatureAccess } from '@/hooks/billing/use-billing';
import { useAuth } from '@/hooks/auth/use-auth';

const PLAN_FOR: Record<string, string> = {
  payroll: 'Standard', statutory: 'Standard', lifecycle: 'Standard', expenses: 'Standard', helpdesk: 'Standard',
  performance: 'Professional', recruitment: 'Professional', analytics: 'Professional', aiAssistant: 'Professional', biometric: 'Professional', googleSignIn: 'Professional',
};

/** Cloud edition: pages outside the plan show an upgrade panel; lapsed plans show a read-only notice. */
export function PlanGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const feature = featureFor(pathname);
  const access = useFeatureAccess(feature);
  const { user } = useAuth();
  if (!feature || access === 'full' || access === undefined) return <>{children}</>;
  if (access === 'read') {
    return (
      <>
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3">
          <p className="text-caption"><span className="font-semibold">Read-only.</span> Your subscription is not active, so you can view this data but not change it.</p>
          <Button asChild size="sm"><Link href="/hr/billing">Renew plan</Link></Button>
        </div>
        {children}
      </>
    );
  }
  const plan = PLAN_FOR[feature] ?? 'a paid';
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-24 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-5 text-title font-semibold">Available on {plan}</h1>
      <p className="mt-3 text-body text-muted-foreground">This part of JantaHR is not included in your company&apos;s current plan.{user?.role === 'SUPER_ADMIN' ? ' You can upgrade in a couple of minutes; your data stays as it is.' : ' Ask your administrator to upgrade.'}</p>
      <div className="mt-8 flex gap-3">
        {user?.role === 'SUPER_ADMIN' && <Button asChild><Link href="/hr/billing">See plans</Link></Button>}
        <Button asChild variant="outline"><Link href="/dashboard">Back to overview</Link></Button>
      </div>
    </div>
  );
}
