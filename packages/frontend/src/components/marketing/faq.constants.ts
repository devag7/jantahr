import { CHARGES_GST } from '@/lib/operator';

/** Buyer questions, answered once: the pricing page shows all of them and the home page the first five. */
export const FAQ: { q: string; a: string }[] = [
  { q: 'Is GST included?', a: CHARGES_GST ? 'Prices exclude GST. We add 18% on the invoice: CGST and SGST within our state, IGST for other states. Add your GSTIN under Settings to claim input credit.' : 'No GST is added: the price shown is the price you pay. We are not registered under GST yet, so invoices carry no tax.' },
  { q: 'What counts as an employee?', a: 'Anyone who has not left the company. You choose how many seats to pay for; you can add seats at any time and reduce them at renewal.' },
  { q: 'What happens when the trial ends?', a: 'Your company moves to the Free plan. Nothing is deleted: payroll and the other paid modules become read-only until you choose a plan.' },
  { q: 'Where is our data stored?', a: 'In India, in Supabase Postgres (Mumbai region), encrypted at rest. PAN, Aadhaar and bank numbers are additionally encrypted field by field.' },
  { q: 'Can we move between Cloud and self-hosted?', a: 'Yes. Both editions run the same code and database schema, so a Postgres dump from one restores into the other.' },
  { q: 'How do we pay?', a: 'By card, UPI or netbanking through Razorpay, monthly or yearly. You receive ' + (CHARGES_GST ? 'a GST tax invoice' : 'an invoice') + ' for every charge.' },
];

/** schema.org FAQPage for a list of questions shown on the page. */
export const faqJsonLd = (items: typeof FAQ) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});
