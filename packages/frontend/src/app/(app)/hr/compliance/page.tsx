'use client';
import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useComplianceCalendar, useMarkFiled, useOvertimeReport, useUnmarkFiled } from '@/hooks/compliance/use-compliance';
import { formatDate } from '@/lib/format';
import { PAYROLL } from '@/lib/permissions';
import type { ComplianceItem } from '@/types/compliance';

const CATEGORY: Record<string, string> = { WAGES: 'Wages', TAX: 'Income tax', PF: 'EPF', ESI: 'ESI', BONUS: 'Bonus', EXIT: 'Exit', PRIVACY: 'DPDP', PT: 'Prof. tax', LWF: 'LWF' };
const STATUS_LABEL: Record<string, string> = { DONE: 'Done', OVERDUE: 'Overdue', DUE_SOON: 'Due this week', UPCOMING: 'Upcoming' };
const STATUS_TONE: Record<string, string> = { DONE: 'COMPLETED', OVERDUE: 'REJECTED', DUE_SOON: 'PENDING', UPCOMING: 'NOT_ASKED' };

export default function CompliancePage() {
  const q = useComplianceCalendar();
  const { hasRole } = useAuth();
  const canFile = hasRole(PAYROLL);
  const [filter, setFilter] = React.useState('OPEN');
  const [filing, setFiling] = React.useState<ComplianceItem | null>(null);
  const unmark = useUnmarkFiled();
  const s = q.data?.summary;
  const rows = q.data?.items.filter((i) => (filter === 'OPEN' ? i.status !== 'DONE' : filter === 'ALL' ? true : i.category === filter));
  return (
    <>
      <PageHeader title="Compliance calendar" description="Statutory deadlines for wages, TDS, EPF, ESI, returns, exits and data protection, from 45 days ago to 60 days ahead." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overdue" value={s?.OVERDUE ?? '-'} tone={s?.OVERDUE ? 'destructive' : 'default'} />
        <StatCard label="Due in 7 days" value={s?.DUE_SOON ?? '-'} tone={s?.DUE_SOON ? 'warning' : 'default'} />
        <StatCard label="Upcoming" value={s?.UPCOMING ?? '-'} />
        <StatCard label="Done" value={s?.DONE ?? '-'} tone="success" />
      </div>
      <Tabs defaultValue="calendar">
        <TabsList><TabsTrigger value="calendar">Deadlines</TabsTrigger><TabsTrigger value="overtime">Overtime cap</TabsTrigger></TabsList>
        <TabsContent value="calendar" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <NativeSelect aria-label="Filter" className="w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="OPEN">Open items</option><option value="ALL">Everything</option>
              {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </div>
          <DataTable rows={rows} loading={q.isLoading} error={q.error} rowKey={(r) => r.key} emptyTitle="Nothing due" emptyDescription="No statutory deadlines match this filter."
            columns={[
              { key: 'd', header: 'Due date', cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatDate(r.dueDate, false)}</span> },
              { key: 't', header: 'Obligation', cell: (r) => <div><p className="font-semibold">{r.link ? <Link href={r.link} className="hover:text-primary hover:underline">{r.title}</Link> : r.title}</p><p className="text-fine text-muted-foreground">{r.law}</p></div> },
              { key: 'c', header: 'Area', cell: (r) => CATEGORY[r.category] ?? r.category, hideOnMobile: true },
              { key: 's', header: 'Status', cell: (r) => <div><StatusBadge status={STATUS_TONE[r.status]} label={STATUS_LABEL[r.status]} />{r.doneAt && <p className="mt-0.5 text-fine text-muted-foreground">{formatDate(r.doneAt, false)}{r.reference ? ` · ${r.reference}` : ''}</p>}</div> },
              { key: 'a', header: '', align: 'right', cell: (r) => !canFile || r.auto ? (r.auto && r.status !== 'DONE' ? <span className="text-fine text-muted-foreground">Tracked automatically</span> : null)
                : r.status === 'DONE' ? <Button size="sm" variant="ghost" disabled={unmark.isPending} onClick={() => unmark.mutate(r.key)}>Undo</Button>
                : <Button size="sm" variant="outline" onClick={() => setFiling(r)}>Mark filed</Button> },
            ]} />
          <p className="text-fine text-muted-foreground">Dates follow central rules notified up to September 2026 (see the legal notes). Professional tax and LWF due dates vary by state and are not listed.</p>
        </TabsContent>
        <TabsContent value="overtime" className="mt-4"><OvertimeTab /></TabsContent>
      </Tabs>
      <FileModal item={filing} onClose={() => setFiling(null)} />
    </>
  );
}

function FileModal({ item, onClose }: { item: ComplianceItem | null; onClose: () => void }) {
  const mark = useMarkFiled();
  const [ref, setRef] = React.useState('');
  React.useEffect(() => setRef(''), [item?.key]);
  return (
    <Modal open={!!item} onOpenChange={(o) => !o && onClose()} title="Mark as filed" description={item?.title}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (item) mark.mutate({ key: item.key, reference: ref || undefined }, { onSuccess: onClose }); }}>
        <Field label="Challan / acknowledgement number" htmlFor="ref" hint="Optional, but auditors will ask for it."><Input id="ref" value={ref} maxLength={120} onChange={(e) => setRef(e.target.value)} placeholder="e.g. CIN or TRRN" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={mark.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}

function OvertimeTab() {
  const q = useOvertimeReport();
  return (
    <div className="space-y-2">
      <p className="text-caption text-muted-foreground">OSH Code Central Rules 2026 cap overtime at {q.data?.cap ?? 125} hours per quarter, paid at twice the ordinary rate. {q.data && <>Quarter {formatDate(q.data.quarterStart, false)} - {formatDate(q.data.quarterEnd, false)}.</>}</p>
      <DataTable rows={q.data?.employees} loading={q.isLoading} error={q.error} rowKey={(r) => r.employee.id} emptyTitle="No overtime recorded this quarter"
        columns={[
          { key: 'e', header: 'Employee', cell: (r) => <div><p className="font-semibold">{r.employee.firstName} {r.employee.lastName}</p><p className="text-fine text-muted-foreground">{r.employee.employeeCode}</p></div> },
          { key: 'h', header: 'Overtime hours', align: 'right', cell: (r) => <span className="tabular-nums">{r.hours}</span> },
          { key: 's', header: 'Against cap', cell: (r) => <StatusBadge status={r.state === 'OVER' ? 'REJECTED' : r.state === 'NEAR' ? 'PENDING' : 'COMPLETED'} label={r.state === 'OVER' ? 'Over the cap' : r.state === 'NEAR' ? '80%+ used' : 'Within cap'} /> },
        ]} />
    </div>
  );
}
