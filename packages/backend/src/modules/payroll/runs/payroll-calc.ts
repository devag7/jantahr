import { addDays, isoDate } from '../../../common/utils/dates';

export type AttendanceStatusLite = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'WORK_FROM_HOME' | 'HOLIDAY';

export interface DayRecord {
  status: AttendanceStatusLite;
  /** Set when the day is (partly) covered by a leave: paid leave never causes LOP, unpaid (LWP) does. */
  leaveKind?: 'PAID' | 'UNPAID';
}

export interface LopInput {
  days: Date[]; // employment window
  isNonWorking: (d: Date) => boolean;
  records: Map<string, DayRecord>; // key: YYYY-MM-DD
  treatUnmarkedAsLop: boolean;
  today: Date;
}

export interface LopResult {
  lopByDay: Map<string, number>;
  lopDays: number;
  absentDays: number;
  unpaidLeaveDays: number;
  unmarkedWorkingDays: number;
  workingDays: number;
}

/**
 * Loss-of-pay derivation from attendance:
 *  ABSENT → 1, unpaid leave → 1 (0.5 for half-day), half-day worked → 0.5.
 *  Days with no record on a working day count as LOP only when `treatUnmarkedAsLop` is set (else surfaced as a warning).
 *  Future dates are never LOP.
 */
export function computeLop(i: LopInput): LopResult {
  const lopByDay = new Map<string, number>();
  let absent = 0;
  let unpaidLeave = 0;
  let unmarked = 0;
  let working = 0;

  for (const d of i.days) {
    const key = isoDate(d);
    const nonWorking = i.isNonWorking(d);
    if (!nonWorking) working++;
    if (d > i.today) continue;
    const rec = i.records.get(key);
    let lop = 0;
    if (rec) {
      switch (rec.status) {
        case 'ABSENT':
          if (!nonWorking) { lop = 1; absent += 1; }
          break;
        case 'ON_LEAVE':
          if (rec.leaveKind === 'UNPAID') { lop = 1; unpaidLeave += 1; }
          break;
        case 'HALF_DAY':
          if (rec.leaveKind === 'UNPAID') { lop = 0.5; unpaidLeave += 0.5; }
          else if (!rec.leaveKind) { lop = 0.5; absent += 0.5; } // worked only half a day, no leave applied
          break;
        default:
          break;
      }
    } else if (!nonWorking) {
      if (i.treatUnmarkedAsLop) { lop = 1; absent += 1; } else unmarked++;
    }
    if (lop) lopByDay.set(key, lop);
  }
  const lopDays = [...lopByDay.values()].reduce((a, b) => a + b, 0);
  return { lopByDay, lopDays, absentDays: absent, unpaidLeaveDays: unpaidLeave, unmarkedWorkingDays: unmarked, workingDays: working };
}

/** Months of the FY (Apr-Mar) remaining including `month` (1-12). */
export function monthsRemainingInFY(month: number): number {
  return month >= 4 ? 16 - month : 4 - month;
}

export { addDays };
