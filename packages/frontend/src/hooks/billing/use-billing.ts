'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { useAuth } from '@/hooks/auth/use-auth';
import { billingService } from '@/services/billing/billing.service';
import type { FeatureKey } from '@/types/billing';

const B = [['billing']] as const;
export const useEntitlements = () => {
  const { isAuthenticated } = useAuth();
  return useQuery({ queryKey: ['billing', 'entitlements'], queryFn: billingService.entitlements, enabled: isAuthenticated, staleTime: 60_000 });
};
/** 'full' | 'read' | 'none' | undefined (still loading) */
export function useFeatureAccess(feature?: FeatureKey) {
  const q = useEntitlements();
  if (!feature) return 'full' as const;
  if (!q.data) return undefined;
  if (q.data.features.includes(feature)) return 'full' as const;
  if (q.data.readOnlyFeatures.includes(feature)) return 'read' as const;
  return 'none' as const;
}
export const useBillingOverview = () => useQuery({ queryKey: ['billing', 'overview'], queryFn: billingService.overview });
export const useCheckout = () => useApiMutation(billingService.checkout);
export const useConfirmCheckout = () => useApiMutation(billingService.confirm, { invalidate: [...B], success: 'Your plan is active' });
export const useChangeSeats = () => useApiMutation((seats: number) => billingService.seats(seats), { invalidate: [...B], success: 'Seats updated' });
export const useCancelSubscription = () => useApiMutation(() => billingService.cancel(), { invalidate: [...B], success: 'Subscription will end at the close of this period' });
