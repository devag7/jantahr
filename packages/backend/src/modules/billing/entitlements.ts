import { CORE_FEATURES, FEATURES, FeatureKey, PAST_DUE_GRACE_DAYS, PLANS, PlanKey, TRIAL_PLAN } from './plans';

export interface SubscriptionLike {
  plan: PlanKey;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'HALTED' | 'CANCELLED' | 'EXPIRED';
  seats: number;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  lapsedPlan: PlanKey | null;
  updatedAt?: Date;
}

export interface Entitlements {
  edition: 'self_hosted' | 'cloud';
  plan: PlanKey | 'SELF_HOSTED';
  status: SubscriptionLike['status'] | 'SELF_HOSTED';
  features: FeatureKey[];
  /** Features that were paid for earlier: readable, but no new writes. */
  readOnlyFeatures: FeatureKey[];
  /** Maximum active employees; null = unlimited */
  seatLimit: number | null;
  trialEndsAt: Date | null;
  notice: string | null;
}

const ALL = Object.keys(FEATURES) as FeatureKey[];

export function selfHostedEntitlements(): Entitlements {
  return { edition: 'self_hosted', plan: 'SELF_HOSTED', status: 'SELF_HOSTED', features: ALL, readOnlyFeatures: [], seatLimit: null, trialEndsAt: null, notice: null };
}

const days = (n: number) => n * 86_400_000;

/** What a cloud tenant may use right now. Pure: every branch is unit tested. */
export function resolveEntitlements(sub: SubscriptionLike | null, now = new Date()): Entitlements {
  const base = { edition: 'cloud' as const, trialEndsAt: sub?.trialEndsAt ?? null };
  const free = (lapsed: PlanKey | null, notice: string | null): Entitlements => ({
    ...base, plan: 'FREE', status: sub?.status ?? 'ACTIVE', features: CORE_FEATURES,
    readOnlyFeatures: lapsed ? PLANS[lapsed].features.filter((f) => !CORE_FEATURES.includes(f)) : [],
    seatLimit: PLANS.FREE.maxEmployees, notice,
  });
  const paid = (plan: PlanKey, seats: number | null, notice: string | null): Entitlements => ({
    ...base, plan, status: sub!.status, features: PLANS[plan].features, readOnlyFeatures: [], seatLimit: plan === 'FREE' ? PLANS.FREE.maxEmployees : seats, notice,
  });
  if (!sub) return free(null, null);

  switch (sub.status) {
    case 'TRIALING':
      if (sub.trialEndsAt && sub.trialEndsAt > now) {
        const left = Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / days(1));
        return paid(TRIAL_PLAN, null, `Free trial of ${PLANS[TRIAL_PLAN].name}: ${left} day${left === 1 ? '' : 's'} left`);
      }
      return free(TRIAL_PLAN, 'Your free trial has ended. Choose a plan to keep using payroll and the other paid modules.');
    case 'ACTIVE':
      return paid(sub.plan, sub.plan === 'FREE' ? PLANS.FREE.maxEmployees : sub.seats, null);
    case 'PAST_DUE': {
      const since = sub.currentPeriodEnd ?? sub.updatedAt ?? now;
      if (now.getTime() - since.getTime() <= days(PAST_DUE_GRACE_DAYS)) return paid(sub.plan, sub.seats, 'Your last payment failed. Update your payment method to avoid interruption.');
      return free(sub.plan, 'Your subscription is unpaid. Paid modules are read-only until the payment goes through.');
    }
    case 'CANCELLED':
      if (sub.currentPeriodEnd && sub.currentPeriodEnd > now) return paid(sub.plan, sub.seats, `Your subscription ends on ${sub.currentPeriodEnd.toISOString().slice(0, 10)}.`);
      return free(sub.lapsedPlan ?? sub.plan, 'Your subscription has ended. Paid modules are read-only.');
    case 'HALTED':
    case 'EXPIRED':
    default:
      return free(sub.lapsedPlan ?? (sub.plan === 'FREE' ? null : sub.plan), 'Your subscription is inactive. Paid modules are read-only.');
  }
}
