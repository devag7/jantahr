import type { Cycle, FeatureKey, PlanDef } from '@/types/billing';
import { PLANS } from './plans.generated';

/** Whole rupees from paise, with Indian digit grouping: 1,20,000. */
export const formatRupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/** The per-employee monthly price on a billing cycle, or null for a plan priced by quote. */
export const planPrice = (plan: PlanDef, cycle: Cycle) => (plan.pricePaise ? plan.pricePaise[cycle] : null);

/** The first plan, in price order, that includes a feature: how a module is labelled ("Standard", "Professional"). */
export const lowestPlanWith = (feature: FeatureKey): PlanDef | undefined => PLANS.find((p) => p.features.includes(feature));
