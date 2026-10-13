/**
 * GST on the subscription (SaaS is taxed at 18%). Intra-state sales split CGST + SGST; inter-state is IGST.
 * `rate` is 0 for a seller that is not registered under GST: the split is then all zeros and total = taxable.
 */
import { GST_RATE } from './plans';

export interface GstSplit { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number }

export function gstOnTaxable(taxablePaise: number, sellerState: string, buyerState: string | null | undefined, rate = GST_RATE): GstSplit {
  const tax = Math.round(taxablePaise * rate);
  const intra = !!buyerState && buyerState.trim().toLowerCase() === sellerState.trim().toLowerCase();
  const cgst = intra ? Math.floor(tax / 2) : 0;
  const sgst = intra ? tax - cgst : 0;
  return { taxablePaise, cgstPaise: cgst, sgstPaise: sgst, igstPaise: intra ? 0 : tax, totalPaise: taxablePaise + tax };
}

/** When the provider charges a GST-inclusive amount, recover the taxable value. */
export function gstFromInclusive(totalPaise: number, sellerState: string, buyerState: string | null | undefined, rate = GST_RATE): GstSplit {
  if (!rate) return { taxablePaise: totalPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise };
  const taxable = Math.round(totalPaise / (1 + rate));
  const split = gstOnTaxable(taxable, sellerState, buyerState, rate);
  // keep the total exactly what was charged; any 1-paisa rounding lands in the tax
  const diff = totalPaise - split.totalPaise;
  if (split.igstPaise) split.igstPaise += diff; else split.sgstPaise += diff;
  return { ...split, totalPaise };
}

/** Sequential per financial year: JH/2026-27/000042 */
export function invoiceNumber(issuedAt: Date, sequence: number, prefix = 'JH'): string {
  const y = issuedAt.getUTCFullYear();
  const fy = issuedAt.getUTCMonth() < 3 ? y - 1 : y;
  return `${prefix}/${fy}-${String(fy + 1).slice(2)}/${String(sequence).padStart(6, '0')}`;
}
