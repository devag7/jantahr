/**
 * Plan catalogue: the single source for prices, limits and features. The web pricing page is generated from this file
 * (`pnpm --filter jantahr-backend plans:sync`), and a unit test fails if the generated copy is stale.
 * Prices are per active employee per month in paise, before 18% GST.
 */
export const FEATURES = {
  core: 'Employees, org chart, documents, policies, announcements',
  leave: 'Leave policies, accrual, encashment, comp-off',
  attendance: 'Web & mobile check-in, geo-fence, selfie, shifts',
  selfService: 'Employee self-service on web and mobile',
  privacy: 'DPDP privacy tools: consent, data export, erasure, breach register',
  payroll: 'Payroll with PF, ESI, PT, LWF, TDS and payslips',
  statutory: 'ECR, ESI, PT, Form 24Q / 143, bank advice, compliance calendar',
  lifecycle: 'Onboarding, exits and full & final settlement',
  expenses: 'Expense claims, travel requests and reimbursements',
  helpdesk: 'HR helpdesk tickets',
  performance: 'Goals, appraisal cycles and salary revisions',
  recruitment: 'Job openings, careers page, interviews and offers',
  analytics: 'MIS reports, custom report builder, attrition and anomaly insights',
  aiAssistant: 'Policy answers written by an AI model',
  biometric: 'Biometric device integration',
  googleSignIn: 'Sign in with Google (Supabase Auth)',
} as const;
export type FeatureKey = keyof typeof FEATURES;

/** Available on every plan, including Free. Privacy tools are a legal duty, so they are never gated. */
export const CORE_FEATURES: FeatureKey[] = ['core', 'leave', 'attendance', 'selfService', 'privacy'];

export type PlanKey = 'FREE' | 'STANDARD' | 'PROFESSIONAL' | 'ENTERPRISE';
export type Cycle = 'MONTHLY' | 'ANNUAL';

export interface PlanDef {
  key: PlanKey;
  name: string;
  summary: string;
  /** per employee per month, paise, before GST; null = contact sales */
  pricePaise: { MONTHLY: number; ANNUAL: number } | null;
  /** maximum active employees; null = no limit (paid plans are limited by seats bought) */
  maxEmployees: number | null;
  minSeats: number;
  features: FeatureKey[];
  highlights: string[];
}

const STANDARD_FEATURES: FeatureKey[] = [...CORE_FEATURES, 'payroll', 'statutory', 'lifecycle', 'expenses', 'helpdesk'];
const PROFESSIONAL_FEATURES: FeatureKey[] = [...STANDARD_FEATURES, 'performance', 'recruitment', 'analytics', 'aiAssistant', 'biometric', 'googleSignIn'];

export const PLANS: Record<PlanKey, PlanDef> = {
  FREE: {
    key: 'FREE', name: 'Free', summary: 'Core HR, leave and attendance for small teams.',
    pricePaise: { MONTHLY: 0, ANNUAL: 0 }, maxEmployees: 20, minSeats: 0, features: CORE_FEATURES,
    highlights: ['Up to 20 employees', 'Leave and attendance', 'Web and mobile self-service', 'DPDP privacy tools'],
  },
  STANDARD: {
    key: 'STANDARD', name: 'Standard', summary: 'Payroll and statutory compliance, done every month.',
    pricePaise: { MONTHLY: 5900, ANNUAL: 4900 }, maxEmployees: null, minSeats: 10, features: STANDARD_FEATURES,
    highlights: ['Everything in Free', 'Payroll with PF, ESI, PT, LWF and TDS', 'ECR, returns and compliance calendar', 'Onboarding, exits and F&F', 'Expenses and helpdesk'],
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL', name: 'Professional', summary: 'The full suite for growing companies.',
    pricePaise: { MONTHLY: 11900, ANNUAL: 9900 }, maxEmployees: null, minSeats: 10, features: PROFESSIONAL_FEATURES,
    highlights: ['Everything in Standard', 'Performance and appraisals', 'Recruitment and careers page', 'Analytics and custom reports', 'AI policy answers, biometric devices, Google sign-in'],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE', name: 'Enterprise', summary: 'Dedicated database, SLA and assisted rollout.',
    pricePaise: null, maxEmployees: null, minSeats: 250, features: PROFESSIONAL_FEATURES,
    highlights: ['Everything in Professional', 'Dedicated Supabase project in India', '99.9% uptime SLA', 'Assisted payroll migration'],
  },
};

export const TRIAL_PLAN: PlanKey = 'PROFESSIONAL';
export const TRIAL_DAYS = 14;
/** Days of full access after a failed renewal before the plan lapses. */
export const PAST_DUE_GRACE_DAYS = 7;
export const GST_RATE = 0.18;

/** Amount for one billing period, in paise, before GST. Annual plans are billed for 12 months up front. */
export function periodPricePaise(plan: PlanKey, cycle: Cycle, seats: number): number {
  const p = PLANS[plan].pricePaise;
  if (!p) throw new Error(`${plan} is priced by quote`);
  return p[cycle] * seats * (cycle === 'ANNUAL' ? 12 : 1);
}

export const planFeatures = (plan: PlanKey): FeatureKey[] => PLANS[plan].features;
