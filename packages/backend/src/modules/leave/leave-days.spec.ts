import { computeLeaveDays } from './leave-days';
import { toDateOnly } from '../../common/utils/dates';

// Sat/Sun weekly off; 2026-01-26 (Mon) holiday
const nonWorking = (d: Date) => [0, 6].includes(d.getUTCDay()) || d.toISOString().slice(0, 10) === '2026-01-26';
const D = toDateOnly;
const base = { includeHolidays: false, sandwichRule: false, isNonWorking: nonWorking };

describe('computeLeaveDays', () => {
  it('excludes weekly offs and holidays by default', () => {
    // Fri 23 Jan → Tue 27 Jan: Fri, (Sat, Sun), (Mon holiday), Tue → 2 working days
    expect(computeLeaveDays({ ...base, from: D('2026-01-23'), to: D('2026-01-27') }).totalDays).toBe(2);
  });
  it('sandwich rule counts non-working days between two leave days', () => {
    expect(computeLeaveDays({ ...base, sandwichRule: true, from: D('2026-01-23'), to: D('2026-01-27') }).totalDays).toBe(5);
  });
  it('sandwich rule does not count leading/trailing non-working days', () => {
    // Sat 24 → Sun 25 only: no bounded run → 0
    expect(computeLeaveDays({ ...base, sandwichRule: true, from: D('2026-01-24'), to: D('2026-01-25') }).totalDays).toBe(0);
    // Fri 23 → Sun 25: trailing weekend not counted
    expect(computeLeaveDays({ ...base, sandwichRule: true, from: D('2026-01-23'), to: D('2026-01-25') }).totalDays).toBe(1);
  });
  it('includeHolidays counts every calendar day (e.g. maternity)', () => {
    expect(computeLeaveDays({ ...base, includeHolidays: true, from: D('2026-01-23'), to: D('2026-01-27') }).totalDays).toBe(5);
  });
  it('half-day on a working date deducts 0.5', () => {
    expect(computeLeaveDays({ ...base, from: D('2026-01-21'), to: D('2026-01-22'), halfDay: true, halfDayDate: D('2026-01-22') }).totalDays).toBe(1.5);
  });
  it('single half-day leave is 0.5', () => {
    expect(computeLeaveDays({ ...base, from: D('2026-01-21'), to: D('2026-01-21'), halfDay: true, halfDayDate: D('2026-01-21') }).totalDays).toBe(0.5);
  });
});
