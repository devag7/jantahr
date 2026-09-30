import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/marketing-nav';

export const metadata: Metadata = { title: 'Terms of service' };

const SECTIONS: [string, string][] = [
  ['The service', 'JantaHR Cloud provides HR, payroll and compliance software. Statutory calculations follow the rules in force as notified by the central and state governments; your company remains responsible for filings and should have payroll reviewed by its chartered accountant.'],
  ['Plans and billing', 'Paid plans are billed per seat, monthly or yearly, in advance, plus 18% GST. Adding seats takes effect immediately and is pro-rated; reducing seats takes effect at renewal. Prices may change with 30 days’ notice.'],
  ['Trials and the Free plan', 'New companies get a 14-day trial of Professional. When it ends, the company moves to the Free plan (up to 20 employees) and paid modules become read-only; nothing is deleted.'],
  ['Cancellation', 'You can cancel at any time from Billing. Paid features continue until the end of the paid period; the company then moves to the Free plan with its data intact and paid modules read-only.'],
  ['Acceptable use', 'Do not upload data you have no right to process, attempt to access another company’s data, or resell the service without a written agreement.'],
  ['Liability', 'The service is provided with reasonable skill and care. Our total liability in any year is limited to the fees paid in that year, except where the law does not allow a limit.'],
];

export default function TermsPage() {
  return (
    <>
      <MarketingNav title="Terms" />
      <main className="bg-background px-4 py-16">
        <article className="mx-auto max-w-[760px]">
          <h1 className="text-title font-semibold">Terms of service</h1>
          <p className="mt-2 text-caption text-muted-foreground">Last updated September 2026. Draft for review by counsel before launch.</p>
          {SECTIONS.map(([h, b]) => (<section key={h} className="mt-10"><h2 className="text-tagline font-semibold">{h}</h2><p className="mt-3 text-body text-secondary-foreground">{b}</p></section>))}
        </article>
      </main>
    </>
  );
}
