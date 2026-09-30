export type FeatureKey = 'core' | 'leave' | 'attendance' | 'selfService' | 'privacy' | 'payroll' | 'statutory' | 'lifecycle' | 'expenses' | 'helpdesk' | 'performance' | 'recruitment' | 'analytics' | 'aiAssistant' | 'biometric' | 'googleSignIn';
export type PlanKey = 'FREE' | 'STANDARD' | 'PROFESSIONAL' | 'ENTERPRISE';
export type Cycle = 'MONTHLY' | 'ANNUAL';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'HALTED' | 'CANCELLED' | 'EXPIRED';

export interface Entitlements {
  edition: 'self_hosted' | 'cloud';
  plan: PlanKey | 'SELF_HOSTED';
  status: SubscriptionStatus | 'SELF_HOSTED';
  features: FeatureKey[];
  readOnlyFeatures: FeatureKey[];
  seatLimit: number | null;
  trialEndsAt: string | null;
  notice: string | null;
}
export interface PlanDef {
  key: PlanKey; name: string; summary: string; pricePaise: { MONTHLY: number; ANNUAL: number } | null;
  maxEmployees: number | null; minSeats: number; features: FeatureKey[]; highlights: string[];
}
export interface GstSplit { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number }
export interface Subscription {
  id: string; plan: PlanKey; status: SubscriptionStatus; cycle: Cycle; seats: number; trialEndsAt: string | null; currentPeriodStart: string | null;
  currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; provider: string | null; providerSubscriptionId: string | null; pendingSeats: number | null;
}
export interface Invoice {
  id: string; number: string; plan: PlanKey; cycle: Cycle; seats: number; periodStart: string; periodEnd: string; taxablePaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number; issuedAt: string; provider: string;
}
export interface BillingOverview {
  edition: 'self_hosted' | 'cloud'; currency: 'INR'; gstRate: number; trialDays: number; features: Record<FeatureKey, string>; plans: PlanDef[];
  provider: 'razorpay' | 'mock' | null; razorpayKeyId: string | null; subscription: Subscription | null; entitlements: Entitlements;
  usage: { activeEmployees: number; seatLimit: number | null }; invoices: Invoice[];
}
export interface CheckoutResult { provider: 'razorpay' | 'mock'; subscriptionId: string; razorpayKeyId: string | null; amount: GstSplit; prefill: { name: string; email: string } }
export interface RuntimeConfig { edition: 'self_hosted' | 'cloud'; supabase: { url: string; publishableKey: string; realtime: boolean } | null; googleSignIn: boolean; directUploads?: boolean }
