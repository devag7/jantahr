import type { Metadata } from 'next';
import { pageDescription } from '@/lib/site';
import { ContactLine, LegalPage } from '@/components/marketing/legal-page';
import { INVOICE, OPERATOR, PLUS_GST } from '@/lib/operator';

export const metadata: Metadata = { title: 'Cancellation and refunds', description: pageDescription('/legal/refunds'), alternates: { canonical: '/legal/refunds' } };

const SECTIONS: [string, string][] = [
  ['Free trial and Free plan', 'Every new company starts with a 14-day trial of the Professional plan. No payment details are taken for the trial and nothing is charged when it ends: the company moves to the Free plan, which costs nothing for up to 20 employees.'],
  ['How billing works', `Paid plans are subscriptions billed per employee seat, monthly or yearly, in advance, in Indian rupees${PLUS_GST}. Payments are collected by Razorpay. Each charge produces ${INVOICE === 'invoice' ? 'an invoice' : 'a GST tax invoice'} that the account owner can download from Billing.`],
  ['Cancelling', 'The account owner can cancel at any time from Billing in the app; no call or email is needed. Cancellation stops all future renewals. Paid features stay available until the end of the period already paid for, after which the company moves to the Free plan. Its data is kept and paid modules become read-only.'],
  ['Refunds', 'Because a cancelled subscription keeps working until the end of the paid period, we do not refund the unused part of a month or year. We refund in full when you were charged in error: a duplicate charge, a charge after a confirmed cancellation, or a charge for more seats than you ordered.'],
  ['Reducing seats or changing plan', 'Adding seats takes effect immediately and is charged pro rata for the rest of the period. Reducing seats or moving to a lower plan takes effect at the next renewal and does not produce a refund for the current period.'],
  ['How to ask for a refund, and how long it takes', 'Write to us from the account owner’s email address within 30 days of the charge, with the invoice number. We reply within 2 working days. An approved refund is sent to the original payment method through Razorpay within 5 to 7 working days; your bank may take a few more days to show it.'],
  ['Failed payments', 'If a renewal payment fails, Razorpay retries it and we notify the account owner. If it still cannot be collected the subscription is paused and the company moves to the Free plan; nothing is deleted, and paying again restores the plan.'],
];

export default function RefundsPage() {
  return (
    <LegalPage title="Cancellation and refunds" sections={SECTIONS}>
      <ContactLine email={OPERATOR.email} />
    </LegalPage>
  );
}
