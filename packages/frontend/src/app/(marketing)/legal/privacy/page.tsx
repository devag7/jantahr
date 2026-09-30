import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { SALES_EMAIL } from '@/lib/edition';

export const metadata: Metadata = { title: 'Privacy notice' };

const SECTIONS: [string, string][] = [
  ['Who we are', 'JantaHR Cloud is operated by the JantaHR team. For employee records, your employer is the data fiduciary under the Digital Personal Data Protection Act, 2023 and we process that data on its instructions. For the account details of people who sign up or contact us, we are the data fiduciary.'],
  ['What we process', 'Account data (name, work email, phone, company), the HR and payroll records your employer enters, usage logs kept for security, and payment details handled by Razorpay (we never see full card numbers).'],
  ['Where it is stored', 'In India, in Supabase Postgres in the Mumbai region, encrypted at rest and in transit. PAN, Aadhaar and bank account numbers are additionally encrypted field by field with AES-256-GCM.'],
  ['How long we keep it', 'While your company’s account exists. A cancelled subscription moves the company to the Free plan and keeps its data; to close the account and delete its data, the account owner writes to us and we delete it within 30 days, except tax invoices, which the GST law requires us to keep for eight years. Access logs are kept for one year. Statutory payroll records of employees who have left follow the retention your employer sets under Data protection.'],
  ['Your rights', 'Employees can view, download and request correction or erasure of their data from Privacy in the app; requests are answered within 90 days. Account holders can write to us at the address below. You may complain to the Data Protection Board of India.'],
  ['Breaches', 'If a personal data breach affects your data we will tell you without delay and report to the Data Protection Board within 72 hours, as the DPDP Rules require.'],
];

export default function PrivacyPage() {
  return (
    <>
      <MarketingNav title="Privacy notice" />
      <main className="bg-background px-4 py-16">
        <article className="mx-auto max-w-[760px]">
          <h1 className="text-title font-semibold">Privacy notice</h1>
          <p className="mt-2 text-caption text-muted-foreground">Last updated September 2026. Draft for review by counsel before launch.</p>
          {SECTIONS.map(([h, b]) => (<section key={h} className="mt-10"><h2 className="text-tagline font-semibold">{h}</h2><p className="mt-3 text-body text-secondary-foreground">{b}</p></section>))}
          <p className="mt-10 text-body">Contact: <a className="text-primary hover:underline" href={`mailto:${SALES_EMAIL}`}>{SALES_EMAIL}</a></p>
        </article>
      </main>
    </>
  );
}
