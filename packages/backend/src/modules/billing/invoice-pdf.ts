import PDFDocument = require('pdfkit');
import { BillingInvoice } from '@prisma/client';
import { PLANS, PlanKey } from './plans';

const C = { ink: '#1d1d1f', muted: '#6e6e73', line: '#e0e0e0', accent: '#0066cc' };
const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toISOString().slice(0, 10);

export interface Seller { name: string; address: string; state: string; gstin: string; sac: string }

/** GST tax invoice (Rule 46 fields: supplier & recipient details, number, date, SAC, taxable value, tax split, total). */
export function invoicePdf(inv: BillingInvoice, seller: Seller): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Tax invoice ${inv.number}` } });
  const out: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('data', (c) => out.push(c)); doc.on('end', () => resolve(Buffer.concat(out))); doc.on('error', reject); });
  const W = doc.page.width - 96;

  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.ink).text('Tax invoice', 48, 48);
  doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(`${inv.number}   ·   ${day(inv.issuedAt)}`, 48, 74);

  let y = 110;
  const block = (x: number, title: string, lines: (string | null | undefined)[]) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted).text(title.toUpperCase(), x, y);
    doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(lines.filter(Boolean).join('\n'), x, y + 14, { width: W / 2 - 16 });
  };
  block(48, 'From', [seller.name, seller.address, `State: ${seller.state}`, seller.gstin ? `GSTIN: ${seller.gstin}` : null]);
  block(48 + W / 2, 'Billed to', [inv.buyerName, inv.buyerState ? `State: ${inv.buyerState}` : null, inv.buyerGstin ? `GSTIN: ${inv.buyerGstin}` : 'GSTIN: not provided']);

  y = 230;
  doc.moveTo(48, y).lineTo(48 + W, y).strokeColor(C.line).lineWidth(0.8).stroke();
  y += 12;
  const row = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(C.ink).text(label, 48, y, { width: W - 140 });
    doc.text(value, 48, y, { width: W, align: 'right' });
    y += 20;
  };
  const plan = PLANS[inv.plan as PlanKey]?.name ?? inv.plan;
  row(`JantaHR ${plan} plan, ${inv.seats} employees, ${inv.cycle === 'ANNUAL' ? 'yearly' : 'monthly'} (SAC ${seller.sac})`, rs(inv.taxablePaise));
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(`Service period ${day(inv.periodStart)} to ${day(inv.periodEnd)}`, 48, y - 6);
  y += 14;
  doc.moveTo(48, y).lineTo(48 + W, y).strokeColor(C.line).stroke();
  y += 12;
  row('Taxable value', rs(inv.taxablePaise));
  if (inv.igstPaise) row('IGST @ 18%', rs(inv.igstPaise));
  else { row('CGST @ 9%', rs(inv.cgstPaise)); row('SGST @ 9%', rs(inv.sgstPaise)); }
  row('Total', rs(inv.totalPaise), true);
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(`Paid via ${inv.provider}${inv.providerPaymentId ? ` (${inv.providerPaymentId})` : ''}. Tax payable on reverse charge: No.`, 48, y + 8, { width: W });
  doc.fontSize(7.5).text('This is a computer-generated invoice and does not require a signature.', 48, doc.page.height - 72, { width: W, align: 'center' });
  doc.end();
  return done;
}
