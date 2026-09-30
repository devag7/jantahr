import { addDays, eachDay, isoDate, toDateOnly } from '../../common/utils/dates';

export interface LeaveDaysInput {
  from: Date;
  to: Date;
  halfDay?: boolean;
  halfDayDate?: Date | null;
  includeHolidays: boolean;
  sandwichRule: boolean;
  isNonWorking: (d: Date) => boolean;
}

export interface LeaveDaysResult {
  totalDays: number;
  countedDates: string[];
  excludedDates: string[];
}

/**
 * Number of leave days between two dates:
 *  - if the leave type includes holidays, every calendar day counts;
 *  - otherwise weekly offs/holidays are excluded, EXCEPT under the sandwich rule where a run of
 *    non-working days lying between two leave days inside the same application counts as leave;
 *  - a half-day on a working date inside the range counts as 0.5.
 */
export function computeLeaveDays(i: LeaveDaysInput): LeaveDaysResult {
  const days = eachDay(toDateOnly(i.from), toDateOnly(i.to));
  const working = days.map((d) => !i.isNonWorking(d));
  const counted = days.map(() => false);

  days.forEach((_, idx) => {
    if (i.includeHolidays || working[idx]) counted[idx] = true;
  });

  if (!i.includeHolidays && i.sandwichRule) {
    let idx = 0;
    while (idx < days.length) {
      if (working[idx]) {
        idx++;
        continue;
      }
      let end = idx;
      while (end + 1 < days.length && !working[end + 1]) end++;
      const bounded = idx > 0 && end < days.length - 1; // working leave day on both sides within the application
      if (bounded) for (let k = idx; k <= end; k++) counted[k] = true;
      idx = end + 1;
    }
  }

  let total = counted.filter(Boolean).length;
  if (i.halfDay && i.halfDayDate) {
    const hd = isoDate(toDateOnly(i.halfDayDate));
    const idx = days.findIndex((d) => isoDate(d) === hd);
    if (idx >= 0 && counted[idx]) total -= 0.5;
  }
  return {
    totalDays: total,
    countedDates: days.filter((_, k) => counted[k]).map(isoDate),
    excludedDates: days.filter((_, k) => !counted[k]).map(isoDate),
  };
}

export { addDays };
