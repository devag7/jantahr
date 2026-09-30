import type { PrivacyRequestType } from '@/types/privacy';

export const REQUEST_TYPES: { value: PrivacyRequestType; label: string; hint: string }[] = [
  { value: 'ACCESS', label: 'Access my data', hint: 'Ask what personal data is held about you and why. You can also download it instantly above.' },
  { value: 'CORRECTION', label: 'Correct my data', hint: 'Something in your record is wrong or out of date.' },
  { value: 'ERASURE', label: 'Erase my data', hint: 'Applies once you have left. Records the law requires us to keep (payroll, PF, tax) are retained for the statutory period.' },
  { value: 'GRIEVANCE', label: 'Raise a grievance', hint: 'Concerns about how your personal data is handled.' },
  { value: 'NOMINATION', label: 'Nominate a person', hint: 'Name someone to exercise your rights if you die or become incapacitated.' },
];
export const REQUEST_LABEL = Object.fromEntries(REQUEST_TYPES.map((t) => [t.value, t.label])) as Record<PrivacyRequestType, string>;

export const NOTICE_SECTIONS: { title: string; body: string }[] = [
  { title: 'What we collect', body: 'Identity and contact details, employment and salary records, bank and tax identifiers (PAN, bank account, UAN/ESIC), attendance and leave, performance reviews, expense claims, and helpdesk conversations. Optional: a selfie and GPS location when you check in.' },
  { title: 'Why we process it', body: 'To employ and pay you and to meet legal duties: provident fund, ESI, professional tax, income-tax (TDS), gratuity and labour-law records. This is a legitimate use under section 7 of the DPDP Act and does not need your consent.' },
  { title: 'Who can see it', body: 'You see all of your own data. Managers see their reporting team’s work information. HR and payroll administrators see what their role needs. Identifiers such as PAN, Aadhaar and bank numbers are encrypted at rest and shown masked to anyone who does not need them. Every change is written to an audit log.' },
  { title: 'How long we keep it', body: 'While you work here and afterwards for the period the law requires (payroll and tax records are kept for 8 years after you leave by default). After that your record is anonymised.' },
  { title: 'Your rights', body: 'You can access and download your data, ask for corrections, ask for erasure once you have left (subject to the retention above), raise a grievance, and nominate someone to act for you. Use the request form below; HR must respond within 90 days (DPDP Rules 2025, rule 14).' },
];
