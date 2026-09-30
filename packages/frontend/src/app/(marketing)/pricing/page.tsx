import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { PricingPlans } from '@/components/marketing/pricing-plans';

export const metadata: Metadata = { title: 'Pricing', description: 'Per-employee pricing for JantaHR Cloud, and the free self-hosted edition.' };

const FAQ = [
  ['Is GST included?', 'Prices exclude GST. We add 18% on the invoice: CGST and SGST for Karnataka, IGST for other states. Add your GSTIN under Settings to claim input credit.'],
  ['What counts as an employee?', 'Anyone who has not left the company. You choose how many seats to pay for; you can add seats at any time and reduce them at renewal.'],
  ['What happens when the trial ends?', 'Your company moves to the Free plan. Nothing is deleted: payroll and the other paid modules become read-only until you choose a plan.'],
  ['Where is our data stored?', 'In India, in Supabase Postgres (Mumbai region), encrypted at rest. PAN, Aadhaar and bank numbers are additionally encrypted field by field.'],
  ['Can we move between Cloud and self-hosted?', 'Yes. Both editions run the same code and database schema, so a Postgres dump from one restores into the other.'],
  ['How do we pay?', 'By card, UPI or netbanking through Razorpay, monthly or yearly. You receive a GST tax invoice for every charge.'],
];

export default function PricingPage() {
  return (
    <>
      <MarketingNav title="Pricing" />
      <main className="bg-background px-4 pb-24 pt-16">
        <div className="mx-auto max-w-[1080px]">
          <div className="mx-auto max-w-[760px] text-center">
            <h1 className="text-display font-semibold sm:text-hero">Pay per employee.</h1>
            <p className="mt-4 text-tagline font-normal text-secondary-foreground sm:text-lead">Every plan includes leave, attendance, self-service and the DPDP privacy tools.</p>
          </div>
          <div className="mt-12"><PricingPlans /></div>
          <section className="mx-auto mt-24 max-w-[760px]">
            <h2 className="text-center text-display font-semibold">Questions</h2>
            <div className="mt-10 divide-y rounded-lg border bg-card">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-8 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-body font-semibold">{q}<span className="text-primary transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
                  <p className="mt-3 text-body text-secondary-foreground">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
