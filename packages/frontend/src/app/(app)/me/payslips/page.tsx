'use client';
import * as React from 'react';
import { FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { DownloadButton } from '@/components/common/download-button';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { SlipDetailModal } from '@/components/payroll/slip-detail';
import { useMySlips } from '@/hooks/payroll/use-payroll';
import { formatINR, monthLabel } from '@/lib/format';
import { payrollService } from '@/services/payroll/payroll.service';
import type { Slip } from '@/types/payroll';

export default function PayslipsPage() {
  const q = useMySlips();
  const [open, setOpen] = React.useState<Slip | null>(null);
  const thisFy = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const [fy, setFy] = React.useState(thisFy);
  return (
    <>
      <PageHeader title="Payslips" description="Your published salary slips. Download a PDF any time."
        actions={<><NativeSelect aria-label="Financial year" value={fy} onChange={(e) => setFy(Number(e.target.value))} className="w-36">{[thisFy, thisFy - 1, thisFy - 2].map((y) => <option key={y} value={y}>FY {y}-{String(y + 1).slice(2)}</option>)}</NativeSelect>
          <DownloadButton variant="outline" onDownload={() => payrollService.downloadForm16(fy)}>Tax statement</DownloadButton></>} />
      <QueryBoundary query={q} empty={{ when: (d) => d.length === 0, title: 'No payslips yet', description: 'Payslips appear here once payroll for a month is approved.' }}>
        {(slips) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slips.map((s) => (
              <Card key={s.id} className="p-4">
                <button className="flex w-full items-start justify-between text-left" onClick={() => setOpen(s)}>
                  <div><p className="font-semibold">{monthLabel(s.month, s.year)}</p><p className="mt-1 text-display-sm font-semibold tabular-nums">{formatINR(s.netPay)}</p><p className="text-fine text-muted-foreground">Gross {formatINR(s.grossPay)} · Deductions {formatINR(s.totalDeductions)}</p></div>
                  <div className="flex flex-col items-end gap-2"><FileText className="h-5 w-5 text-muted-foreground" /><StatusBadge status={s.status} label={s.status === 'PAID' ? 'Paid' : 'Published'} /></div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
      <SlipDetailModal slip={open} onClose={() => setOpen(null)} />
    </>
  );
}
