'use client';
import { taxForms } from '@/lib/india';
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { DownloadButton } from '@/components/common/download-button';
import { MonthPicker } from '@/components/common/month-picker';
import { PageHeader } from '@/components/common/page-header';
import { ErrorState, LoadingBlock } from '@/components/common/states';
import { fiscalYearOptions } from '@/components/payroll/fy';
import { formatINR, MONTH_SHORT } from '@/lib/format';
import { payrollService } from '@/services/payroll/payroll.service';
import type { StatutoryReport } from '@/types/payroll';

interface EcrPreview { rows: unknown[]; warnings: string[]; totals: { wages: number; ee: number; eps: number; epf: number; edli: number; admin: number; members: number } }
interface CsvPreview { rows: unknown[]; total?: number; missingBankDetails?: string[] }

function useReport<T>(name: StatutoryReport, params: object) {
  return useQuery({ queryKey: ['payroll', 'report', name, params], queryFn: () => payrollService.reportJson<T>(name, params), retry: false });
}

function ReportCard({ title, description, children, action }: { title: string; description: string; children?: React.ReactNode; action: React.ReactNode }) {
  return (
    <Card><CardHeader className="space-y-1"><CardTitle>{title}</CardTitle><p className="text-caption text-muted-foreground">{description}</p></CardHeader><CardContent className="space-y-3">{children}<div>{action}</div></CardContent></Card>
  );
}

const Warn = ({ items }: { items: string[] }) => items.length ? <div className="rounded-md border bg-muted p-2.5 text-fine"><p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5 text-warning" />{items.length} issue(s)</p><ul className="mt-1 max-h-24 list-disc space-y-0.5 overflow-y-auto pl-5">{items.map((w) => <li key={w}>{w}</li>)}</ul></div> : null;

export default function StatutoryPage() {
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [ym, setYm] = React.useState({ m: prev.getMonth() + 1, y: prev.getFullYear() });
  const fys = fiscalYearOptions();
  const [fy, setFy] = React.useState(fys[0].value);
  const [quarter, setQuarter] = React.useState(1);
  const [rate, setRate] = React.useState('8.33');
  const period = { month: ym.m, year: ym.y };
  const tag = `${MONTH_SHORT[ym.m - 1]}-${ym.y}`;
  const ecr = useReport<EcrPreview>('ecr', period);
  const esi = useReport<CsvPreview>('esi', period);
  const pt = useReport<CsvPreview>('pt', period);
  const bank = useReport<CsvPreview>('bank-advice', period);

  return (
    <>
      <PageHeader title="Statutory & bank" description="Filing and payment files generated from approved payroll. Validate with your CA before filing."
        actions={<MonthPicker month={ym.m} year={ym.y} onChange={(m, y) => setYm({ m, y })} />} />
      <p className="mb-4 rounded-md border bg-muted p-3 text-caption">Statutory rates and slabs are seeded defaults stored in the database (PF/ESI ceilings, professional-tax and LWF tables, tax-year 2026-27 income-tax slabs). Have them verified for your state and filing period before submitting to EPFO / ESIC / TRACES.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="EPF: ECR file" description={`EPFO Electronic Challan-cum-Return for ${tag} (#~# text format, due by the 15th).`} action={<DownloadButton variant="outline" onDownload={() => payrollService.downloadReport('ecr', period, `ECR_${tag}.txt`)}>Download ECR</DownloadButton>}>
          {ecr.isLoading ? <LoadingBlock rows={2} /> : ecr.error ? <ErrorState error={ecr.error} /> : ecr.data && (<><dl className="grid grid-cols-3 gap-2 text-caption"><div><dt className="text-fine text-muted-foreground">Members</dt><dd className="font-semibold">{ecr.data.totals.members}</dd></div><div><dt className="text-fine text-muted-foreground">EPF wages</dt><dd className="font-semibold">{formatINR(ecr.data.totals.wages)}</dd></div><div><dt className="text-fine text-muted-foreground">Employee EPF</dt><dd className="font-semibold">{formatINR(ecr.data.totals.ee)}</dd></div><div><dt className="text-fine text-muted-foreground">Employer EPS</dt><dd className="font-semibold">{formatINR(ecr.data.totals.eps)}</dd></div><div><dt className="text-fine text-muted-foreground">Employer EPF</dt><dd className="font-semibold">{formatINR(ecr.data.totals.epf)}</dd></div><div><dt className="text-fine text-muted-foreground">EDLI + admin</dt><dd className="font-semibold">{formatINR(ecr.data.totals.edli + ecr.data.totals.admin)}</dd></div></dl><Warn items={ecr.data.warnings} /></>)}
        </ReportCard>
        <ReportCard title="ESI contribution" description={`Employee 0.75% + employer 3.25% for ${tag}, IP-wise CSV for the ESIC portal.`} action={<DownloadButton variant="outline" onDownload={() => payrollService.downloadReport('esi', period, `ESI_${tag}.csv`)}>Download CSV</DownloadButton>}>
          {esi.isLoading ? <LoadingBlock rows={1} /> : esi.error ? <ErrorState error={esi.error} /> : <p className="text-caption">{esi.data?.rows.length ?? 0} insured person(s) with contributions.</p>}
        </ReportCard>
        <ReportCard title="Professional tax" description={`State-wise professional tax deducted in ${tag}.`} action={<DownloadButton variant="outline" onDownload={() => payrollService.downloadReport('pt', period, `PT_${tag}.csv`)}>Download CSV</DownloadButton>}>
          {pt.isLoading ? <LoadingBlock rows={1} /> : pt.error ? <ErrorState error={pt.error} /> : <p className="text-caption">{pt.data?.rows.length ?? 0} employee(s) · total <b>{formatINR(pt.data?.total ?? 0)}</b></p>}
        </ReportCard>
        <ReportCard title="Bank advice (NEFT/IMPS)" description={`Net salary payments for ${tag}: approved payroll only.`} action={<DownloadButton variant="outline" onDownload={() => payrollService.downloadReport('bank-advice', period, `BankAdvice_${tag}.csv`)}>Download CSV</DownloadButton>}>
          {bank.isLoading ? <LoadingBlock rows={1} /> : bank.error ? <ErrorState error={bank.error} /> : (<><p className="text-caption">{bank.data?.rows.length ?? 0} payment(s) · total <b>{formatINR(bank.data?.total ?? 0)}</b></p><Warn items={(bank.data?.missingBankDetails ?? []).map((n) => `Missing bank details: ${n}`)} /></>)}
        </ReportCard>
        <ReportCard title="Salary register" description={`Component-wise register of all salary slips for ${tag}.`} action={<DownloadButton variant="outline" onDownload={() => payrollService.downloadReport('register', period, `SalaryRegister_${tag}.csv`)}>Download CSV</DownloadButton>} />
        <ReportCard title={`${taxForms(fy).quarterlyReturn}: salary TDS extract`} description={`Quarterly deductee-wise TDS on salary for ${taxForms(fy).yearLabel.toLowerCase()} ${fy}-${String(fy + 1).slice(2)}. Validate in the RPU before filing.`} action={<DownloadButton variant="outline" onDownload={() => payrollService.downloadReport('24q', { fy: fy, quarter }, `${taxForms(fy).quarterlyReturn.replace(' ', '')}_${fy}_Q${quarter}.csv`)}>Download CSV</DownloadButton>}>
          <div className="flex gap-2"><NativeSelect aria-label="Financial year" value={fy} onChange={(e) => setFy(Number(e.target.value))}>{fys.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect><NativeSelect aria-label="Quarter" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className="w-36">{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</NativeSelect></div>
        </ReportCard>
        <ReportCard title="Statutory bonus" description="Code on Wages s.26 (S.O. 4710/4711(E), 25-Aug-2026): wages up to ₹21,000 qualify; bonus on ₹7,000 or the minimum wage, whichever is higher, × months × rate." action={<DownloadButton variant="outline" onDownload={() => payrollService.downloadReport('bonus', { fy, rate }, `Bonus_FY${fy}.csv`)}>Download CSV</DownloadButton>}>
          <div className="flex items-center gap-2"><NativeSelect aria-label="Financial year" value={fy} onChange={(e) => setFy(Number(e.target.value))}>{fys.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect><Input aria-label="Bonus rate %" type="number" min="8.33" max="20" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="w-28" /><span className="text-caption text-muted-foreground">% (8.33-20)</span></div>
        </ReportCard>
      </div>
      <p className="mt-6 text-fine text-muted-foreground">Employees download their own tax statement ({taxForms(fy).certificate} summary) from <Link href="/me/payslips" className="text-primary hover:underline">Payslips</Link>. The official {taxForms(fy).certificate} is downloaded from TRACES after the {taxForms(fy).quarterlyReturn} return is filed.</p>
    </>
  );
}
