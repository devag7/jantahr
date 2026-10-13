import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/marketing/legal-page';
import { INVOICE, OPERATOR } from '@/lib/operator';

export const metadata: Metadata = { title: 'Shipping and delivery' };

const SECTIONS: [string, string][] = [
  ['Nothing is shipped', 'JantaHR is software delivered over the internet. We do not sell or ship physical goods, so there are no shipping charges, couriers or delivery addresses.'],
  ['When you get access', 'The free trial starts as soon as the account owner confirms their email address. A paid plan is activated automatically when Razorpay confirms the payment, normally within a few minutes; the account owner sees the new plan under Billing and receives a notification in the app.'],
  ['Invoices', `${INVOICE === 'invoice' ? 'An invoice' : 'A GST tax invoice'} for every payment is available to download from Billing as soon as the payment is confirmed.`],
  ['If access does not arrive', 'If a payment has left your account and the plan is not active within 2 hours, write to us with the payment reference. We will activate the plan or refund the payment within 2 working days.'],
  ['Where the service is available', 'The service is offered to businesses in India and is priced in Indian rupees. Data is stored in India.'],
];

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping and delivery" sections={SECTIONS}>
      <ContactLine email={OPERATOR.email} />
    </LegalPage>
  );
}
