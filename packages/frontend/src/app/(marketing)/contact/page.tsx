import type { Metadata } from 'next';
import { ContactForm } from '@/components/marketing/contact-form';
import { INLINE_LINK, LegalPage } from '@/components/marketing/legal-page';
import { OPERATOR } from '@/lib/operator';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Write to JantaHR about sales, billing, refunds, privacy requests or your account. We reply within 2 working days.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  const rows: [string, React.ReactNode][] = [
    ['Operated by', OPERATOR.name],
    ...(OPERATOR.url ? [['Website', <a key="site" className={INLINE_LINK} href={OPERATOR.url}>{OPERATOR.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>] as [string, React.ReactNode]] : []),
    ...(OPERATOR.address ? [['Address', OPERATOR.address] as [string, React.ReactNode]] : []),
    ['Email', <a key="email" className={INLINE_LINK} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>],
    ...(OPERATOR.phone ? [['Phone', <a key="phone" className={INLINE_LINK} href={`tel:${OPERATOR.phone.replace(/[^+\d]/g, '')}`}>{OPERATOR.phone}</a>] as [string, React.ReactNode]] : []),
    ...(OPERATOR.gstin ? [['GSTIN', OPERATOR.gstin] as [string, React.ReactNode]] : []),
    ['Hours', 'Monday to Friday, 10:00 to 18:00 IST, except public holidays'],
  ];
  return (
    <LegalPage
      title="Contact us"
      dated={false}
      intro="For sales, billing, refunds, privacy requests or help with your account, reach us here. We reply within 2 working days."
      sections={[
        ['Send us a message', <ContactForm key="form" email={OPERATOR.email} />],
        ['How to reach us', (
          <dl key="s24" className="grid gap-x-8 gap-y-3 sm:grid-cols-[160px_1fr]">
            {rows.map(([label, value]) => (<div key={label} className="contents"><dt className="font-semibold text-foreground">{label}</dt><dd>{value}</dd></div>))}
          </dl>
        )],
        ['Billing questions', 'Write from the account owner’s email address and include the invoice number shown under Billing in the app, so we can find the payment quickly.'],
        ['Privacy and grievances', 'To exercise your rights under the Digital Personal Data Protection Act, 2023, or to raise a grievance, write to the email address above with the subject “Privacy”. We acknowledge within 2 working days.'],
      ]}
    />
  );
}
