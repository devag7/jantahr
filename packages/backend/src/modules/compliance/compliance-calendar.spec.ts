import { addWorkingDays, annualDueDates, calendarQuarter, fnfDueDate, gratuityDueDate, monthlyDueDates } from './compliance-calendar';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe('monthly statutory due dates', () => {
  it('salary by the 7th, TDS by the 7th, PF/ESI by the 15th of the next month', () => {
    const r = monthlyDueDates(2026, 9, { pf: true, esi: true, tdsForms: { quarterlyReturn: 'Form 143' } });
    expect(Object.fromEntries(r.map((i) => [i.category, i.dueDate]))).toEqual({ WAGES: '2026-10-07', TAX: '2026-10-07', PF: '2026-10-15', ESI: '2026-10-15' });
  });
  it('December rolls into January; March TDS is due 30 April', () => {
    expect(monthlyDueDates(2026, 12, { pf: false, esi: false, tdsForms: { quarterlyReturn: 'x' } }).map((i) => i.dueDate)).toEqual(['2027-01-07', '2027-01-07']);
    expect(monthlyDueDates(2027, 3, { pf: false, esi: false, tdsForms: { quarterlyReturn: 'x' } }).find((i) => i.category === 'TAX')?.dueDate).toBe('2027-04-30');
  });
  it('omits PF / ESI when not applicable', () => {
    expect(monthlyDueDates(2026, 9, { pf: false, esi: false, tdsForms: { quarterlyReturn: 'x' } }).map((i) => i.category)).toEqual(['WAGES', 'TAX']);
  });
});

describe('annual due dates', () => {
  it('quarterly returns, certificate and bonus for tax year 2026-27', () => {
    const r = annualDueDates(2026, { certificate: 'Form 130', quarterlyReturn: 'Form 143' });
    expect(r.map((i) => i.dueDate)).toEqual(['2026-07-31', '2026-10-31', '2027-01-31', '2027-05-31', '2027-06-15', '2027-11-30']);
    expect(r[0].title).toContain('Form 143');
  });
});

describe('exit deadlines', () => {
  it('F&F within two working days, skipping weekly offs', () => {
    expect(iso(fnfDueDate(d('2026-09-25'), [0]))).toBe('2026-09-28'); // Fri → Sat, (Sun off), Mon
    expect(iso(fnfDueDate(d('2026-09-25'), [0, 6]))).toBe('2026-09-29'); // Fri → Mon, Tue
    expect(iso(addWorkingDays(d('2026-09-21'), 2))).toBe('2026-09-23');
  });
  it('gratuity within 30 days', () => {
    expect(iso(gratuityDueDate(d('2026-09-30')))).toBe('2026-10-30');
  });
  it('calendar quarter bounds', () => {
    const q = calendarQuarter(d('2026-08-14'));
    expect([iso(q.start), iso(q.end)]).toEqual(['2026-07-01', '2026-09-30']);
  });
});
