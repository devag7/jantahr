import { CalendarCheck, Code2, MapPin, ShieldCheck, type LucideIcon } from 'lucide-react';
import { TRIAL_DAYS } from '@/lib/plans';

/**
 * How current the statutory rules are: the month of the latest central and state notifications the payroll engine
 * implements (packages/backend/src/modules/payroll/engine, docs/legal-2026.md). Shown in the trust strip and the
 * law section, so the two cannot disagree.
 */
export const RULES_CURRENT_TO = 'September 2026';

export const TRUST: { icon: LucideIcon; text: string }[] = [
  { icon: MapPin, text: 'Data hosted in India' },
  { icon: ShieldCheck, text: 'Tools for the DPDP Rules 2025' },
  { icon: CalendarCheck, text: `Rules current to ${RULES_CURRENT_TO}` },
  { icon: Code2, text: 'Open source under AGPL-3.0' },
];

/** Under the compliance calendar: the dates it tracks, as the section's own copy states them. */
export const COMPLIANCE_FACTS = [
  // Income-tax: TDS on salary deposited by the 7th of the next month; salaries paid by the 7th (Code on Wages s.17(1))
  { title: 'Salary and TDS', detail: 'by the 7th' },
  // EPF scheme and ESI regulations: contributions by the 15th of the next month
  { title: 'EPF and ESI', detail: 'by the 15th' },
  { title: 'Quarterly returns', detail: 'tracked with their challan numbers' },
];

/** The law chips, grouped so a reader can find their area. Every item is kept word for word. */
export const LAW_CLUSTERS: { title: string; items: string[] }[] = [
  { title: 'Labour codes and wages', items: ['Four labour codes, 50% wage rule', 'EPF wage ceiling ₹25,000', 'Statutory bonus notifications of August 2026'] },
  { title: 'Income tax', items: ['Income-tax Act 2025', 'Form 130 and Form 143', '8 metro cities for HRA'] },
  { title: 'State rules', items: ['Half-yearly PT in Tamil Nadu and Kerala'] },
  { title: 'Privacy', items: ['DPDP Rules 2025'] },
];

/** How a company starts: the three verbs, one sentence each. */
export const STEPS: { title: string; text: string }[] = [
  { title: 'Create your workspace', text: `Sign up with your company name, state and work email; the first ${TRIAL_DAYS} days include every Professional feature.` },
  { title: 'Import employees', text: 'Import a CSV file or follow the guided setup, then assign each person a salary structure and CTC.' },
  { title: 'Run payroll', text: 'Generate, review and approve the month’s run; payslips, bank advice and the EPF ECR file come from it.' },
];
