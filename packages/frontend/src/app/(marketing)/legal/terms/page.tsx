import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/marketing/legal-page';
import { OPERATOR } from '@/lib/operator';

export const metadata: Metadata = { title: 'Terms of service' };

const SECTIONS: [string, string][] = [
  ['Who we are', `JantaHR Cloud is operated by ${OPERATOR.name}${OPERATOR.address ? `, ${OPERATOR.address}` : ''} (“we”). By creating a company account you accept these terms on behalf of that company.`],
  ['The service', 'JantaHR Cloud provides HR, payroll and compliance software. Statutory calculations follow the rules in force as notified by the central and state governments; your company remains responsible for filings and should have payroll reviewed by its chartered accountant.'],
  ['Plans and billing', 'Paid plans are billed per seat, monthly or yearly, in advance, in Indian rupees plus 18% GST. Payments are collected by Razorpay and each one produces a GST tax invoice. Adding seats takes effect immediately and is pro-rated; reducing seats takes effect at renewal. Prices may change with 30 days’ notice.'],
  ['Trials and the Free plan', 'New companies get a 14-day trial of Professional. When it ends, the company moves to the Free plan (up to 20 employees) and paid modules become read-only; nothing is deleted.'],
  ['Cancellation and refunds', 'You can cancel at any time from Billing. Paid features continue until the end of the paid period; the company then moves to the Free plan with its data intact and paid modules read-only. Unused time is not refunded; charges made in error are refunded in full. The Cancellation and refunds policy has the details.'],
  ['Your data', 'Your company owns the data it enters. We process it only to provide the service, as described in the Privacy notice. To close the account and have its data deleted, the account owner writes to us.'],
  ['Acceptable use', 'Do not upload data you have no right to process, attempt to access another company’s data, or resell the service without a written agreement.'],
  ['Liability', 'The service is provided with reasonable skill and care. Our total liability in any year is limited to the fees paid in that year, except where the law does not allow a limit.'],
  ['Changes to these terms', 'We may update these terms. The new version is posted here, and account owners are notified in the app at least 30 days before a change that reduces their rights takes effect.'],
  ['Governing law', 'These terms are governed by the laws of India. Disputes are subject to the courts that have jurisdiction where our office is located.'],
];

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" nav="Terms" sections={SECTIONS}>
      <ContactLine email={OPERATOR.email} />
    </LegalPage>
  );
}
