'use client';
import { Info } from 'lucide-react';
import { DownloadButton } from '@/components/common/download-button';
import { Modal } from '@/components/common/modal';
import { StatusBadge } from '@/components/common/status-badge';
import { payrollService } from '@/services/payroll/payroll.service';
import { formatINR, monthLabel } from '@/lib/format';
import type { Slip } from '@/types/payroll';

function Lines({ title, lines, total, tone }: { title: string; lines: { name: string; amount: number }[]; total: number; tone: string }) {
  return (
    <div>
      <p className={`mb-2 text-fine font-semibold uppercase tracking-wide ${tone}`}>{title}</p>
      <ul className="divide-y rounded-md border">
        {lines.map((l, i) => <li key={l.name + i} className="flex justify-between px-3 py-2 text-caption"><span>{l.name}</span><span className="tabular-nums">{formatINR(l.amount)}</span></li>)}
        <li className="flex justify-between bg-muted/50 px-3 py-2 text-caption font-semibold"><span>Total</span><span className="tabular-nums">{formatINR(total)}</span></li>
      </ul>
    </div>
  );
}

/** Payslip breakdown dialog used by employees (own slips) and payroll admins (any slip). */
export function SlipDetailModal({ slip, onClose }: { slip: Slip | null; onClose: () => void }) {
  return (
    <Modal open={!!slip} onOpenChange={(o) => !o && onClose()} size="lg" title={slip ? `Payslip · ${monthLabel(slip.month, slip.year)}` : ''} description={slip?.employee ? `${slip.employee.name} (${slip.employee.employeeCode})` : undefined}
      footer={slip && <DownloadButton onDownload={() => payrollService.downloadSlip(slip.id, `Payslip_${slip.year}-${slip.month}.pdf`)}>Download PDF</DownloadButton>}>
      {slip && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-caption text-muted-foreground">
            <StatusBadge status={slip.status} />
            <span>Paid days <b className="text-foreground">{slip.paymentDays}</b> of {new Date(slip.year, slip.month, 0).getDate()}</span>
            {slip.leaveWithoutPay + slip.absentDays > 0 && <span>Loss of pay <b className="text-destructive">{slip.leaveWithoutPay + slip.absentDays}</b></span>}
            <span>{slip.taxRegime === 'NEW' ? 'New' : 'Old'} tax regime</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Lines title="Earnings" lines={slip.earnings} total={slip.grossPay} tone="text-success" />
            <Lines title="Deductions" lines={slip.deductions} total={slip.totalDeductions} tone="text-destructive" />
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3"><span className="text-caption font-semibold">Net pay</span><span className="text-tagline font-semibold tabular-nums">{formatINR(slip.netPay)}</span></div>
          {slip.employerContribution > 0 && <p className="flex items-start gap-2 text-fine text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Your employer also contributes {formatINR(slip.employerContribution)} (PF / ESI) that is not part of your take-home.</p>}
          {slip.remarks && <p className="rounded-md border bg-muted p-3 text-fine text-warning">{slip.remarks}</p>}
        </div>
      )}
    </Modal>
  );
}
