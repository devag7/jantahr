import type { Metadata } from 'next';
import { ContactLine, INLINE_LINK, LegalPage } from '@/components/marketing/legal-page';
import { OPERATOR } from '@/lib/operator';
import { REPO_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About JantaHR',
  description: 'JantaHR is open-source HR and payroll software built for Indian statutory rules, offered as a hosted service and as a free self-hosted edition.',
  alternates: { canonical: '/about' },
};

const link = INLINE_LINK;

export default function AboutPage() {
  return (
    <LegalPage
      title="About JantaHR"
      nav="About"
      dated={false}
      intro="JantaHR is HR and payroll software for companies in India. It calculates PF, ESI, TDS, professional tax, labour welfare fund and labour-code wages every month, keeps each filing deadline on one calendar, and gives employees self-service for leave, attendance, payslips and tax declarations."
      sections={[
        ['Why it exists', 'Indian HR software is usually either closed software priced per employee, or a general HR system where you set up PF, ESI and TDS yourself. JantaHR does the statutory work for you and keeps the code open, so a company can read exactly how a figure on a payslip was reached and which notification it rests on.'],
        ['What it covers', 'Employee records and documents, payroll with proration, loss of pay, arrears and loans, EPF ECR and ESI contribution files, professional tax and labour welfare fund registers, salary certificates and the quarterly TDS extract, leave and shift rosters, check-in with location and a selfie, onboarding and exits with full and final settlement, appraisals, recruitment, and the consent, export and erasure tools the Digital Personal Data Protection Act 2023 asks for.'],
        ['Two editions, one codebase', (
          <p key="s25">JantaHR Cloud is the hosted service on this site: data is stored in India, and backups, updates and statutory changes are handled for you. The self-hosted edition is the same code with every feature and no employee limit, free to run on your own servers. Both use the same database schema, so a company can move from one to the other. See <a className={link} href="/pricing">pricing</a> and the <a className={link} href="/self-hosting">self-hosting guide</a>.</p>
        )],
        ['Open source', (
          <p key="s28">The whole product is published under the GNU AGPL-3.0 licence at <a className={link} href={REPO_URL}>github.com/devag7/jantahr</a>, including the payroll engine and its tests. Each statutory rule is listed with the notification it comes from, and corrections are welcome as issues or pull requests.</p>
        )],
        ['A note on statutory outputs', 'Rules are kept current with central and state notifications. Payroll is still your responsibility as an employer: have your chartered accountant review the outputs before you file or pay.'],
        ['Who runs this site', (
          <p key="s32">This hosted edition is operated by {OPERATOR.name}{OPERATOR.address ? `, ${OPERATOR.address}` : ''}. Sales, billing and privacy requests all go through the <a className={link} href="/contact">contact page</a>.</p>
        )],
      ]}
    >
      <ContactLine email={OPERATOR.email} />
    </LegalPage>
  );
}
