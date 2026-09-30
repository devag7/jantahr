import { computeLop, monthsRemainingInFY } from './payroll-calc';
import { toDateOnly, eachDay } from '../../../common/utils/dates';

const D = toDateOnly;
const nonWorking = (d: Date) => d.getUTCDay() === 0; // Sunday off
const days = eachDay(D('2026-08-01'), D('2026-08-31'));
const base = { days, isNonWorking: nonWorking, records: new Map(), treatUnmarkedAsLop: false, today: D('2026-09-30') };

describe('computeLop', () => {
  it('counts ABSENT days and unpaid leave as full LOP, paid leave as none', () => {
    const records = new Map([
      ['2026-08-03', { status: 'ABSENT' as const }],
      ['2026-08-04', { status: 'ON_LEAVE' as const, leaveKind: 'UNPAID' as const }],
      ['2026-08-05', { status: 'ON_LEAVE' as const, leaveKind: 'PAID' as const }],
    ]);
    const r = computeLop({ ...base, records });
    expect(r.lopDays).toBe(2);
    expect(r.absentDays).toBe(1);
    expect(r.unpaidLeaveDays).toBe(1);
  });
  it('half-day worked without leave is 0.5 LOP; paid half-day leave is none; unpaid half-day 0.5', () => {
    const records = new Map([
      ['2026-08-03', { status: 'HALF_DAY' as const }],
      ['2026-08-04', { status: 'HALF_DAY' as const, leaveKind: 'PAID' as const }],
      ['2026-08-05', { status: 'HALF_DAY' as const, leaveKind: 'UNPAID' as const }],
    ]);
    expect(computeLop({ ...base, records }).lopDays).toBe(1);
  });
  it('unmarked working days are LOP only when requested; otherwise reported', () => {
    const off = computeLop(base);
    expect(off.lopDays).toBe(0);
    expect(off.unmarkedWorkingDays).toBe(26); // 31 days − 5 Sundays
    const on = computeLop({ ...base, treatUnmarkedAsLop: true });
    expect(on.lopDays).toBe(26);
  });
  it('never counts future days', () => {
    const r = computeLop({ ...base, treatUnmarkedAsLop: true, today: D('2026-08-10') });
    expect(r.lopDays).toBe(8); // 10 days (1-10 Aug) minus Sundays 2 and 9
  });
  it('ignores ABSENT recorded on a weekly off', () => {
    const records = new Map([['2026-08-02', { status: 'ABSENT' as const }]]);
    expect(computeLop({ ...base, records }).lopDays).toBe(0);
  });
});

describe('monthsRemainingInFY', () => {
  it('counts Apr–Mar inclusive of the current month', () => {
    expect(monthsRemainingInFY(4)).toBe(12);
    expect(monthsRemainingInFY(9)).toBe(7);
    expect(monthsRemainingInFY(12)).toBe(4);
    expect(monthsRemainingInFY(1)).toBe(3);
    expect(monthsRemainingInFY(3)).toBe(1);
  });
});
