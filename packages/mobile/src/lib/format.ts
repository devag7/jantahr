// Shared with the website (see metro.config.js): 07 Oct 2026, 2:30 pm (India time), ₹12,500.
export * from '../../../frontend/src/lib/format/format';

/** YYYY-MM-DD for a local date (the API takes calendar dates without a time). */
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** A calendar date from the API (UTC midnight) or YYYY-MM-DD as a local Date at noon, safe for day arithmetic. */
export const fromISO = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const plural = (n: number, one: string, many = `${one}s`) => `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? one : many}`;
