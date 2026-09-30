import { istMinutesOfDay } from '../../common/utils/dates';

export interface ShiftLite {
  startTime: string;
  endTime: string;
  workingHours: number;
  halfDayThresholdHours: number;
  lateEntryGraceMinutes: number;
  earlyExitGraceMinutes: number;
  isNightShift: boolean;
}

export interface DerivedAttendance {
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT';
  inTime: Date;
  outTime: Date | null;
  workingHours: number | null;
  lateEntry: boolean;
  earlyExit: boolean;
  overtime: number;
  remarks: string | null;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Derive a day's attendance from raw punches (sorted ascending).
 *  - first punch = in, last punch = out (≥1 min later)
 *  - hours ≥ shift hours (minus grace) → PRESENT; ≥ half-day threshold → HALF_DAY; else ABSENT
 *  - no check-out: today → provisional PRESENT, past day → HALF_DAY flagged for regularization
 *  - work on a holiday/weekly-off is PRESENT with the hours recorded as overtime (comp-off eligible)
 */
export function deriveAttendance(punches: Date[], shift: ShiftLite | null, opts: { isToday: boolean; nonWorking: boolean }): DerivedAttendance | null {
  if (!punches.length) return null;
  const inTime = punches[0];
  const last = punches[punches.length - 1];
  const outTime = punches.length > 1 && last.getTime() - inTime.getTime() >= 60000 ? last : null;
  const hours = outTime ? Math.round(((outTime.getTime() - inTime.getTime()) / 3600000) * 100) / 100 : null;

  let status: DerivedAttendance['status'];
  let remarks: string | null = null;
  let lateEntry = false;
  let earlyExit = false;
  let overtime = 0;

  if (opts.nonWorking) {
    remarks = 'Worked on holiday / weekly off';
    return { status: 'PRESENT', inTime, outTime, workingHours: hours, lateEntry: false, earlyExit: false, overtime: hours ?? 0, remarks };
  }

  const shiftHours = shift?.workingHours ?? 8;
  const halfThreshold = shift?.halfDayThresholdHours ?? shiftHours / 2;
  const grace = ((shift?.lateEntryGraceMinutes ?? 0) + (shift?.earlyExitGraceMinutes ?? 0)) / 60;

  if (hours === null) {
    if (opts.isToday) status = 'PRESENT';
    else { status = 'HALF_DAY'; remarks = 'Missing check-out: regularize to correct'; }
  } else if (hours >= shiftHours - grace) status = 'PRESENT';
  else if (hours >= halfThreshold) status = 'HALF_DAY';
  else { status = 'ABSENT'; remarks = 'Insufficient working hours'; }

  if (shift && !shift.isNightShift) {
    lateEntry = istMinutesOfDay(inTime) > toMin(shift.startTime) + shift.lateEntryGraceMinutes;
    if (outTime) earlyExit = istMinutesOfDay(outTime) < toMin(shift.endTime) - shift.earlyExitGraceMinutes;
  }
  if (hours !== null && hours - shiftHours >= 0.5) overtime = Math.round((hours - shiftHours) * 100) / 100;
  return { status, inTime, outTime, workingHours: hours, lateEntry, earlyExit, overtime, remarks };
}
