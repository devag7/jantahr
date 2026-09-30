/**
 * Date-only values are stored as UTC midnight. "Today" is computed in IST (UTC+5:30)
 * because every business rule (attendance, payroll cut-off) is India-local.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDateOnly(input: string | Date): Date {
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
    if (m) return utcDate(+m[1], +m[2], +m[3]);
  }
  const dt = new Date(input);
  return utcDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function todayIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return utcDate(ist.getUTCFullYear(), ist.getUTCMonth() + 1, ist.getUTCDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((toDateOnly(a).getTime() - toDateOnly(b).getTime()) / 86400000);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let d = toDateOnly(from); d.getTime() <= toDateOnly(to).getTime(); d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthRange(year: number, month: number): { start: Date; end: Date; days: number } {
  const start = utcDate(year, month, 1);
  const end = utcDate(year, month + 1, 0);
  return { start, end, days: end.getUTCDate() };
}

/** Indian financial year: Apr-Mar. Returns FY start year for a date. */
export function fiscalYearStartYear(date: Date): number {
  return date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

export function fiscalYearRange(startYear: number): { start: Date; end: Date } {
  return { start: utcDate(startYear, 4, 1), end: utcDate(startYear + 1, 3, 31) };
}

export function fiscalYearLabel(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/** Whole months between two dates counting partial months as full when day>=... (used for tenure) */
export function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * 86400000);
}

/** IST calendar date (as UTC midnight) of an absolute instant. */
export function istDateOf(instant: Date): Date {
  return todayIST(instant);
}

/** Minutes since IST midnight for an absolute instant. */
export function istMinutesOfDay(instant: Date): number {
  const ist = new Date(instant.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** Absolute instant for "HH:mm" IST on the given IST date (UTC-midnight Date). */
export function istInstant(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(date.getTime() + (h * 60 + m) * 60000 - IST_OFFSET_MS);
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
