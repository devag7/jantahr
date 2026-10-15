'use client';
import Link from 'next/link';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEntitlements } from '@/hooks/billing/use-billing';
import { useInAndroidApp } from '@/components/pwa/pwa-bootstrap';

/** Plan notices (trial countdown, failed payment, ended subscription). Cloud edition only. */
export function TrialBanner() {
  const { data } = useEntitlements();
  const { user } = useAuth();
  const androidApp = useInAndroidApp();
  if (!data?.notice || data.edition !== 'cloud') return null;
  const canBuy = user?.role === 'SUPER_ADMIN' && !androidApp;
  return (
    <div className="border-b bg-card">
      <p className="mx-auto max-w-[1440px] px-4 py-2.5 text-center text-caption lg:px-6">
        {data.notice}{canBuy && <> <Link href="/hr/billing" className="text-primary hover:underline">Choose a plan</Link></>}
      </p>
    </div>
  );
}
