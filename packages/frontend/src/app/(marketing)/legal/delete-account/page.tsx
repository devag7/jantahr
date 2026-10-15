import type { Metadata } from 'next';
import { pageDescription } from '@/lib/site';
import { ContactLine, INLINE_LINK, LegalPage } from '@/components/marketing/legal-page';
import { OPERATOR } from '@/lib/operator';

export const metadata: Metadata = { title: 'Delete your account', description: pageDescription('/legal/delete-account'), alternates: { canonical: '/legal/delete-account' } };

/** Linked from the Google Play listing, which requires a public page explaining how to delete an account and its data. */
const SECTIONS: [string, React.ReactNode][] = [
  ['Company accounts', <>The account owner (the Super admin who signed the company up) emails <a className={INLINE_LINK} href={`mailto:${OPERATOR.email}?subject=Delete%20my%20JantaHR%20account`}>{OPERATOR.email}</a> from the address they sign in with, with the subject “Delete my JantaHR account” and the company name. We confirm by reply and delete the company, its users and all of its HR and payroll records within 30 days. A paid plan should be cancelled first from Billing in the web app.</>],
  ['Employees', 'Your employer controls your HR records and closes your login when you leave. To have your data erased, open Privacy in the JantaHR app (web or Android) and send an erasure request, or ask your HR team; your employer answers within 90 days. Erasure applies once you have left the company: while you work there, your employer needs the records to pay you.'],
  ['What is deleted', 'Your login, profile, contact details, documents and photos (including attendance selfies), attendance with its location, leave, expenses, helpdesk tickets and appraisals.'],
  ['What is kept, and for how long', 'Records the law requires are anonymised rather than deleted until their retention period ends. GST tax invoices for payments to JantaHR are kept for eight years, as tax law requires. Statutory payroll records (salary registers, PF, ESI and TDS filings) of employees who have left are kept for the period the labour and tax laws set, usually eight years, and then deleted. Security access logs are kept for one year.'],
];

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your JantaHR account" nav="Delete your account" intro={`How to delete a JantaHR Cloud account and the data in it, for the website and the JantaHR Android app by ${OPERATOR.name}.`} sections={SECTIONS}>
      <ContactLine email={OPERATOR.email} />
    </LegalPage>
  );
}
