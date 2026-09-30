import { deriveAttendance, ShiftLite } from './attendance-derive';
import { istInstant, toDateOnly } from '../../common/utils/dates';

const shift: ShiftLite = { startTime: '09:30', endTime: '18:30', workingHours: 8, halfDayThresholdHours: 4, lateEntryGraceMinutes: 15, earlyExitGraceMinutes: 0, isNightShift: false };
const day = toDateOnly('2026-09-14');
const at = (hhmm: string) => istInstant(day, hhmm);
const opts = { isToday: false, nonWorking: false };

describe('deriveAttendance', () => {
  it('PRESENT for a full day and not late within grace', () => {
    const r = deriveAttendance([at('09:44'), at('18:35')], shift, opts)!;
    expect(r.status).toBe('PRESENT');
    expect(r.lateEntry).toBe(false);
    expect(r.earlyExit).toBe(false);
  });
  it('flags late entry beyond grace and early exit', () => {
    const r = deriveAttendance([at('10:05'), at('18:00')], shift, opts)!;
    expect(r.lateEntry).toBe(true);
    expect(r.earlyExit).toBe(true);
  });
  it('HALF_DAY between threshold and shift hours; ABSENT below threshold', () => {
    expect(deriveAttendance([at('09:30'), at('14:30')], shift, opts)!.status).toBe('HALF_DAY');
    expect(deriveAttendance([at('09:30'), at('12:00')], shift, opts)!.status).toBe('ABSENT');
  });
  it('missing check-out: provisional PRESENT today, HALF_DAY (flagged) for past days', () => {
    expect(deriveAttendance([at('09:30')], shift, { isToday: true, nonWorking: false })!.status).toBe('PRESENT');
    const past = deriveAttendance([at('09:30')], shift, opts)!;
    expect(past.status).toBe('HALF_DAY');
    expect(past.remarks).toMatch(/Missing check-out/);
  });
  it('computes overtime beyond 30 minutes over shift hours', () => {
    expect(deriveAttendance([at('09:30'), at('19:30')], shift, opts)!.overtime).toBe(2);
    expect(deriveAttendance([at('09:30'), at('17:45')], shift, opts)!.overtime).toBe(0);
  });
  it('work on a holiday/weekly off is PRESENT and counted as overtime (comp-off)', () => {
    const r = deriveAttendance([at('10:00'), at('16:00')], shift, { isToday: false, nonWorking: true })!;
    expect(r.status).toBe('PRESENT');
    expect(r.overtime).toBe(6);
  });
  it('returns null with no punches', () => {
    expect(deriveAttendance([], shift, opts)).toBeNull();
  });
});
