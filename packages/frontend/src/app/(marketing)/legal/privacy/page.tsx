import type { Metadata } from 'next';
import { pageDescription } from '@/lib/site';
import { ContactLine, LegalPage } from '@/components/marketing/legal-page';
import { OPERATOR } from '@/lib/operator';

export const metadata: Metadata = { title: 'Privacy notice', description: pageDescription('/legal/privacy'), alternates: { canonical: '/legal/privacy' } };

const SECTIONS: [string, string][] = [
  ['Who we are', `JantaHR Cloud is operated by ${OPERATOR.name}${OPERATOR.address ? `, ${OPERATOR.address}` : ''}. ` + 'For employee records, your employer is the data fiduciary under the Digital Personal Data Protection Act, 2023 and we process that data on its instructions. For the account details of people who sign up or contact us, we are the data fiduciary.'],
  ['What we process', 'Account data (name, work email, phone, company), the HR and payroll records your employer enters, usage logs kept for security, and payment details handled by Razorpay (we never see full card numbers).'],
  ['Signing in with Google', 'If you choose Continue with Google, Google tells us your name, email address and profile picture, and that Google has verified the address. We use them only to sign you in to the JantaHR account with that email address; we do not read your Gmail, contacts or files, and we do not share this data or use it for advertising. You can remove JantaHR from your Google account at any time (myaccount.google.com, Security, Third-party connections).'],
  ['Cookies and analytics', 'Signing in uses cookies and browser storage that keep you signed in; they are required. On the public pages (home, pricing, policies, sign-in and sign-up) we ask before using Google Analytics, which counts visits with cookies and reports which pages are read, from which country and device. It is off until you allow it, never runs inside the app, and does not see HR or payroll data. Change your answer at any time with Cookie settings at the foot of every public page; saying no deletes the analytics cookies. Separately, Vercel Web Analytics counts visits to the same public pages without cookies: it records the page address without anything after it, the referring site, and the country, browser, operating system and type of device, tells visits apart with a hash that changes daily rather than anything that identifies you, and also never runs inside the app.'],
  ['Where it is stored', 'In India, in Supabase Postgres in the Mumbai region, encrypted at rest and in transit. PAN, Aadhaar and bank account numbers are additionally encrypted field by field with AES-256-GCM.'],
  ['How long we keep it', 'While your company’s account exists. A cancelled subscription moves the company to the Free plan and keeps its data; to close the account and delete its data, the account owner writes to us and we delete it within 30 days, except invoices, which tax law requires us to keep for eight years. Access logs are kept for one year. Statutory payroll records of employees who have left follow the retention your employer sets under Data protection.'],
  ['Your rights', 'Employees can view, download and request correction or erasure of their data from Privacy in the app; requests are answered within 90 days. Account holders can write to us at the address below. You may complain to the Data Protection Board of India.'],
  ['Breaches', 'If a personal data breach affects your data we will tell you without delay and report to the Data Protection Board within 72 hours, as the DPDP Rules require.'],
];

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" sections={SECTIONS}>
      <ContactLine email={OPERATOR.email} />
    </LegalPage>
  );
}
