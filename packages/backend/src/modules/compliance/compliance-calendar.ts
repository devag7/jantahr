/**
 * Statutory due dates for Indian payroll (pure — unit tested). Sources, as notified by Sept 2026:
 *  - Code on Wages 2019 s.17(1): monthly wages before the 7th of the next month; s.17(2): separated staff within 2 working days.
 *  - Income-tax: TDS deposit by the 7th (March: 30 April); quarterly salary-TDS return (24Q / Form 143) 31 Jul, 31 Oct, 31 Jan, 31 May;
 *    salary TDS certificate (Form 16 / Form 130) by 15 June.
 *  - EPF ECR and ESI contribution: 15th of the next month.
 *  - Statutory bonus: within 8 months of the close of the accounting year (30 November for an April–March year).
 *  - Gratuity: within 30 days of becoming payable.
 *  - OSH Code Central Rules 2026: overtime capped at 125 hours per quarter.
 */
export type ComplianceCategory = 'WAGES' | 'TAX' | 'PF' | 'ESI' | 'BONUS' | 'EXIT' | 'PRIVACY' | 'PT' | 'LWF';

export interface DueItem {
  key: string;
  title: string;
  category: ComplianceCategory;
  dueDate: string; // YYYY-MM-DD
  law: string;
  period?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const next = (y: number, m: number) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 });

export const OT_QUARTER_CAP_HOURS = 125;

/** Monthly obligations that arise from paying salary for wage month (year, month). */
export function monthlyDueDates(year: number, month: number, o: { pf: boolean; esi: boolean; tdsForms: { quarterlyReturn: string } }): DueItem[] {
  const n = next(year, month);
  const period = `${MONTHS[month - 1]} ${year}`;
  const items: DueItem[] = [
    { key: `wages-${year}-${month}`, title: `Pay ${period} salaries`, category: 'WAGES', dueDate: ymd(n.y, n.m, 7), law: 'Code on Wages s.17(1): before the 7th', period },
    { key: `tds-${year}-${month}`, title: `Deposit TDS on ${period} salaries`, category: 'TAX', dueDate: month === 3 ? ymd(year, 4, 30) : ymd(n.y, n.m, 7), law: 'Income-tax: by the 7th (March: 30 April)', period },
  ];
  if (o.pf) items.push({ key: `pf-${year}-${month}`, title: `File EPF ECR & pay contributions for ${period}`, category: 'PF', dueDate: ymd(n.y, n.m, 15), law: 'EPF scheme: 15th of next month', period });
  if (o.esi) items.push({ key: `esi-${year}-${month}`, title: `Pay ESI contributions for ${period}`, category: 'ESI', dueDate: ymd(n.y, n.m, 15), law: 'ESI: 15th of next month', period });
  return items;
}

/** Quarter-end and annual obligations for the tax year that starts in April of `fyStartYear`. */
export function annualDueDates(fyStartYear: number, forms: { certificate: string; quarterlyReturn: string }): DueItem[] {
  const y = fyStartYear;
  const fy = `${y}-${String(y + 1).slice(2)}`;
  const q = (n: number, date: string): DueItem => ({ key: `tdsq${n}-${y}`, title: `File ${forms.quarterlyReturn} for Q${n} ${fy}`, category: 'TAX', dueDate: date, law: 'Quarterly salary-TDS return', period: `Q${n} ${fy}` });
  return [
    q(1, ymd(y, 7, 31)), q(2, ymd(y, 10, 31)), q(3, ymd(y + 1, 1, 31)), q(4, ymd(y + 1, 5, 31)),
    { key: `cert-${y}`, title: `Issue ${forms.certificate} to employees for ${fy}`, category: 'TAX', dueDate: ymd(y + 1, 6, 15), law: 'Salary TDS certificate: by 15 June', period: fy },
    { key: `bonus-${y}`, title: `Pay statutory bonus for ${fy}`, category: 'BONUS', dueDate: ymd(y + 1, 11, 30), law: 'Code on Wages s.26: within 8 months of year end', period: fy },
  ];
}

/** Adds `n` working days, skipping the company's weekly offs (0 = Sunday). Holidays are not skipped — conservative. */
export function addWorkingDays(from: Date, n: number, weeklyOff: number[] = [0]): Date {
  const d = new Date(from.getTime());
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!weeklyOff.includes(d.getUTCDay())) left--;
  }
  return d;
}

/** Final wages for separated staff: within 2 working days of the last working day (Code on Wages s.17(2)). */
export const fnfDueDate = (lastWorkingDate: Date, weeklyOff: number[]) => addWorkingDays(lastWorkingDate, 2, weeklyOff);
/** Gratuity: within 30 days of becoming payable (the day after the last working day). */
export const gratuityDueDate = (lastWorkingDate: Date) => new Date(lastWorkingDate.getTime() + 30 * 86_400_000);

/** Quarter (Jan–Mar, Apr–Jun, …) containing the date, as [start, end] UTC dates. */
export function calendarQuarter(d: Date): { start: Date; end: Date } {
  const q = Math.floor(d.getUTCMonth() / 3);
  return { start: new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1)), end: new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 0)) };
}
