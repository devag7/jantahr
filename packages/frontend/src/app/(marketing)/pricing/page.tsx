import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { PricingPlans } from '@/components/marketing/pricing-plans';
import { Faq } from '@/components/marketing/faq';
import { FAQ } from '@/components/marketing/faq.constants';

export const metadata: Metadata = { title: 'Pricing', description: 'Per-employee pricing for JantaHR Cloud, and the free self-hosted edition.', alternates: { canonical: '/pricing' } };

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
            <div className="mt-10"><Faq items={FAQ} /></div>
          </section>
        </div>
      </main>
    </>
  );
}
