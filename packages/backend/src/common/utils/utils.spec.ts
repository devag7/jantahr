import { amountInWords, round2 } from './money';
import { parseCsv, toCsv } from './csv';
import { fiscalYearStartYear, istInstant, istMinutesOfDay, monthRange, todayIST, toDateOnly } from './dates';

describe('money', () => {
  it('writes amounts in Indian numbering words', () => {
    expect(amountInWords(208888)).toBe('Two Lakh Eight Thousand Eight Hundred and Eighty Eight Rupees Only');
    expect(amountInWords(12500000)).toBe('One Crore Twenty Five Lakh Rupees Only');
    expect(amountInWords(0)).toBe('Zero Rupees Only');
  });
  it('rounds to 2 decimals without float artefacts', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [{ a: 'x,y', b: 'say "hi"', c: 'line1\nline2' }];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it('ignores blank lines and trims headers', () => {
    expect(parseCsv(' a , b \n1,2\n\n3,4\n')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
});

describe('dates (IST)', () => {
  it('treats 19:00 UTC as the next IST day', () => {
    expect(todayIST(new Date('2026-09-21T19:00:00Z')).toISOString().slice(0, 10)).toBe('2026-09-22');
    expect(todayIST(new Date('2026-09-21T17:00:00Z')).toISOString().slice(0, 10)).toBe('2026-09-21');
  });
  it('builds IST instants and minutes-of-day', () => {
    const t = istInstant(toDateOnly('2026-09-21'), '09:30');
    expect(t.toISOString()).toBe('2026-09-21T04:00:00.000Z');
    expect(istMinutesOfDay(t)).toBe(9 * 60 + 30);
  });
  it('financial year runs April–March', () => {
    expect(fiscalYearStartYear(toDateOnly('2026-03-31'))).toBe(2025);
    expect(fiscalYearStartYear(toDateOnly('2026-04-01'))).toBe(2026);
  });
  it('monthRange handles leap February', () => {
    expect(monthRange(2028, 2).days).toBe(29);
    expect(monthRange(2027, 2).days).toBe(28);
  });
});
