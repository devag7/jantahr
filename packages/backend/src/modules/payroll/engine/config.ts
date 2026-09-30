import { PfTransition, pfCeilingForMonth } from './statutory';

/**
 * EPFO has not published how a wage month that straddles the 17-Sep-2026 ceiling change is filed.
 * PRO_RATA is the default; set PF_CEILING_TRANSITION=NEXT_WAGE_MONTH to keep ₹15,000 for all of September 2026.
 */
export const PF_TRANSITION: PfTransition = process.env.PF_CEILING_TRANSITION === 'NEXT_WAGE_MONTH' ? 'NEXT_WAGE_MONTH' : 'PRO_RATA';

export const pfCeilingFor = (year: number, month: number) => pfCeilingForMonth(year, month, PF_TRANSITION);
/** Ceiling for the current calendar month — for previews and projections that have no wage month of their own. */
export const currentPfCeiling = (now = new Date()) => pfCeilingFor(now.getUTCFullYear(), now.getUTCMonth() + 1);
