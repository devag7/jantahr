/**
 * Product screenshots on the marketing pages, captured by scripts/capture-screenshots.mjs from the seeded demo
 * company. `widths` lists the narrower copies next to each original (name-640.webp and so on), so a phone downloads
 * a 640 px image instead of the 2880 px original.
 */
export interface Shot { src: string; alt: string; width: number; height: number; widths: number[] }

const shot = (name: string, alt: string, width: number, height: number, widths: number[]): Shot => ({ src: `/marketing/${name}.webp`, alt, width, height, widths });

export const SHOTS = {
  overview: shot('overview', 'JantaHR company overview: headcount, attendance today, pending approvals and statutory deadlines', 2880, 1800, [640, 1080, 1600]),
  payroll: shot('payroll', 'A payroll run with gross pay, deductions, net pay and employer contributions for each month', 2400, 1500, [640, 1080, 1600]),
  compliance: shot('compliance', 'Compliance calendar listing salary, TDS, EPF, ESI and return deadlines with their status', 2880, 1800, [640, 1080, 1600]),
  mobile: shot('mobile', 'Employee home screen on a phone with attendance check-in and leave balance', 780, 1560, [390]),
  attendance: shot('attendance', 'An employee’s attendance page: web check-in, the month’s present, half-day and absent counts, and the calendar', 2400, 1500, [640, 1080, 1600]),
  recruitment: shot('recruitment', 'Recruitment pipeline with applicants in the applied, screening and interview stages', 2400, 1500, [640, 1080, 1600]),
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof SHOTS;

/** `srcset` for a shot: every narrower copy plus the original. */
export const srcSetOf = (s: Shot) => [...s.widths.map((w) => `${s.src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`), `${s.src} ${s.width}w`].join(', ');
