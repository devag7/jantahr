import { salaryTdsLaw } from '../engine/tax-forms';
import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { amountInWords, inr } from '../../../common/utils/money';

type Doc = InstanceType<typeof PDFDocument>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const C = { ink: '#0f172a', muted: '#64748b', line: '#e2e8f0', brand: '#1e40af', band: '#eff6ff' };

function collect(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function kv(doc: Doc, x: number, y: number, k: string, v: string, w = 240) {
  doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(k, x, y, { width: 90 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text(v || '-', x + 92, y - 0.5, { width: w - 92 });
}

export interface PayslipData {
  company: { name: string; legalName?: string | null; address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; pan?: string | null };
  employee: { code: string; name: string; department?: string | null; designation?: string | null; doj: string; pan?: string | null; uan?: string | null; bank?: string | null; account?: string | null; location?: string | null };
  month: number;
  year: number;
  paymentDays: number;
  totalDays: number;
  lop: number;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  gross: number;
  totalDeductions: number;
  net: number;
  employer: { pf: number; esi: number };
  regime: string;
}

@Injectable()
export class PdfService {
  async payslip(d: PayslipData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Payslip ${MONTHS[d.month - 1]} ${d.year} - ${d.employee.name}` } });
    const done = collect(doc);
    const W = doc.page.width - 80;

    doc.rect(40, 40, W, 58).fill(C.band);
    doc.fillColor(C.brand).font('Helvetica-Bold').fontSize(15).text(d.company.legalName || d.company.name, 52, 50, { width: W - 24 });
    doc.fillColor(C.muted).font('Helvetica').fontSize(8).text([d.company.address, d.company.city, d.company.state, d.company.pincode].filter(Boolean).join(', ') || ' ', 52, 70, { width: W - 24 });
    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(11).text(`Payslip for ${MONTHS[d.month - 1]} ${d.year}`, 52, 82);

    let y = 116;
    const L = 40;
    const R = 40 + W / 2 + 6;
    kv(doc, L, y, 'Employee ID', d.employee.code); kv(doc, R, y, 'Pay period', `${MONTHS[d.month - 1]} ${d.year}`);
    y += 16; kv(doc, L, y, 'Name', d.employee.name); kv(doc, R, y, 'Paid days', `${d.paymentDays} of ${d.totalDays}`);
    y += 16; kv(doc, L, y, 'Designation', d.employee.designation || ''); kv(doc, R, y, 'Loss of pay', String(d.lop));
    y += 16; kv(doc, L, y, 'Department', d.employee.department || ''); kv(doc, R, y, 'Tax regime', d.regime === 'NEW' ? 'New regime' : 'Old regime');
    y += 16; kv(doc, L, y, 'Date of joining', d.employee.doj); kv(doc, R, y, 'PAN', d.employee.pan || '');
    y += 16; kv(doc, L, y, 'Bank a/c', d.employee.account || ''); kv(doc, R, y, 'UAN', d.employee.uan || '');

    y += 30;
    const colW = (W - 12) / 2;
    const header = (x: number, label: string) => {
      doc.rect(x, y, colW, 20).fill(C.brand);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9).text(label, x + 8, y + 6);
      doc.text('Amount (Rs.)', x, y + 6, { width: colW - 8, align: 'right' });
    };
    header(L, 'EARNINGS');
    header(L + colW + 12, 'DEDUCTIONS');
    y += 24;
    const rows = Math.max(d.earnings.length, d.deductions.length, 1);
    doc.fillColor(C.ink).font('Helvetica').fontSize(9);
    for (let i = 0; i < rows; i++) {
      const e = d.earnings[i];
      const de = d.deductions[i];
      if (e) { doc.text(e.name, L + 8, y, { width: colW - 90 }); doc.text(inr(e.amount), L, y, { width: colW - 8, align: 'right' }); }
      if (de) { doc.text(de.name, L + colW + 20, y, { width: colW - 90 }); doc.text(inr(de.amount), L + colW + 12, y, { width: colW - 8, align: 'right' }); }
      y += 16;
      doc.moveTo(L, y - 3).lineTo(L + colW, y - 3).strokeColor(C.line).lineWidth(0.5).stroke();
      doc.moveTo(L + colW + 12, y - 3).lineTo(L + W, y - 3).stroke();
    }
    y += 4;
    doc.font('Helvetica-Bold').fontSize(9.5);
    doc.text('Gross earnings', L + 8, y); doc.text(inr(d.gross), L, y, { width: colW - 8, align: 'right' });
    doc.text('Total deductions', L + colW + 20, y); doc.text(inr(d.totalDeductions), L + colW + 12, y, { width: colW - 8, align: 'right' });

    y += 30;
    doc.rect(L, y, W, 44).fill(C.band);
    doc.fillColor(C.muted).font('Helvetica').fontSize(8).text('NET PAY', L + 12, y + 8);
    doc.fillColor(C.brand).font('Helvetica-Bold').fontSize(18).text(`Rs. ${inr(d.net)}`, L + 12, y + 20);
    doc.fillColor(C.ink).font('Helvetica-Oblique').fontSize(8.5).text(amountInWords(d.net), L + 200, y + 18, { width: W - 212, align: 'right' });

    y += 62;
    if (d.employer.pf || d.employer.esi) {
      doc.fillColor(C.muted).font('Helvetica').fontSize(8).text(`Employer contributions (not part of take-home): PF Rs. ${inr(d.employer.pf)}${d.employer.esi ? `, ESI Rs. ${inr(d.employer.esi)}` : ''}`, L, y);
      y += 14;
    }
    doc.fillColor(C.muted).fontSize(7.5).text('This is a system-generated payslip and does not require a signature.', L, doc.page.height - 60, { width: W, align: 'center' });
    doc.end();
    return done;
  }

  async form16Summary(d: {
    company: { name: string; tan?: string | null; pan?: string | null };
    employee: { code: string; name: string; pan?: string | null };
    fy: string;
    regime: string;
    rows: [string, number][];
    grossSalary: number;
    taxable: number;
    taxOnIncome: number;
    rebate: number;
    surcharge: number;
    cess: number;
    totalTax: number;
    tdsDeducted: number;
  }): Promise<Buffer> {
    const law = salaryTdsLaw(parseInt(String(d.fy).slice(0, 4), 10));
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Tax statement ${d.fy} - ${d.employee.name}` } });
    const done = collect(doc);
    const W = doc.page.width - 80;
    doc.fillColor(C.brand).font('Helvetica-Bold').fontSize(15).text(`Annual Tax Statement (${law.certificate} salary summary)`, 40, 44);
    doc.fillColor(C.muted).font('Helvetica').fontSize(9).text(`${law.yearLabel} ${d.fy} · ${d.regime === 'NEW' ? 'New' : 'Old'} tax regime · ${law.act} ${law.section}`, 40, 66);
    let y = 92;
    kv(doc, 40, y, 'Employer', d.company.name); kv(doc, 300, y, 'Employer TAN', d.company.tan || '');
    y += 16; kv(doc, 40, y, 'Employee', d.employee.name); kv(doc, 300, y, 'Employee PAN', d.employee.pan || '');
    y += 30;
    const line = (label: string, amount: number, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(C.ink).text(label, 40, y, { width: W - 120 });
      doc.text(inr(amount), 40, y, { width: W, align: 'right' });
      y += 17;
      doc.moveTo(40, y - 3).lineTo(40 + W, y - 3).strokeColor(C.line).lineWidth(0.5).stroke();
    };
    line('Gross salary', d.grossSalary, true);
    for (const [k, v] of d.rows) line(`Less: ${k}`, v);
    line('Total taxable income', d.taxable, true);
    y += 8;
    line('Tax on total income', d.taxOnIncome);
    if (d.rebate) line('Less: rebate u/s 87A (incl. marginal relief)', d.rebate);
    if (d.surcharge) line('Add: surcharge', d.surcharge);
    line('Add: health & education cess (4%)', d.cess);
    line('Total tax payable', d.totalTax, true);
    line('Tax deducted at source (TDS)', d.tdsDeducted, true);
    line(d.totalTax - d.tdsDeducted > 0 ? 'Balance tax payable' : 'Excess deducted (refund claimable)', Math.abs(d.totalTax - d.tdsDeducted));
    doc.fillColor(C.muted).fontSize(7.5).text(`Summary computed from processed payroll and declared investments. The official ${law.certificate} is downloaded from TRACES after the ${law.quarterlyReturn} return is filed.`, 40, doc.page.height - 60, { width: W, align: 'center' });
    doc.end();
    return done;
  }
}
