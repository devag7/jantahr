import { downloadFile, get, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { BillingOverview, CheckoutResult, Cycle, Entitlements } from '@/types/billing';

export const billingService = {
  entitlements: () => get<Entitlements>(E.billing.entitlements),
  overview: () => get<BillingOverview>(E.billing.overview),
  checkout: (d: { plan: 'STANDARD' | 'PROFESSIONAL'; cycle: Cycle; seats: number }) => post<CheckoutResult>(E.billing.checkout, d),
  confirm: (d: { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string }) => post<BillingOverview>(E.billing.confirm, d),
  seats: (seats: number) => post(E.billing.seats, { seats }),
  cancel: () => post(E.billing.cancel),
  invoicePdf: (id: string, number: string) => downloadFile(E.billing.invoicePdf(id), undefined, `${number.replace(/\//g, '-')}.pdf`),
};
