'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { useAuth } from '@/hooks/auth/use-auth';
import { useAssign, useAssignments, usePreviewStructure, useStructures } from '@/hooks/payroll/use-payroll';
import { formatDate, formatINR, todayISO } from '@/lib/format';
import { PAYROLL } from '@/lib/permissions';
import type { StructurePreview, TaxRegime } from '@/types/payroll';

export function CompensationTab({ employeeId, currentCtc }: { employeeId: string; currentCtc?: number | null }) {
  const { hasRole } = useAuth();
  const canEdit = hasRole(PAYROLL);
  const list = useAssignments(employeeId);
  const structures = useStructures();
  const assign = useAssign();
  const preview = usePreviewStructure();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ salaryStructureId: '', base: String(currentCtc ?? ''), fromDate: todayISO(), taxRegime: 'NEW' as TaxRegime });
  const [pv, setPv] = React.useState<StructurePreview | null>(null);
  const { mutate: runPreview } = preview;

  React.useEffect(() => { if (open && !f.salaryStructureId && structures.data?.length) setF((s) => ({ ...s, salaryStructureId: structures.data.find((x) => x.isActive)?.id ?? '' })); }, [open, structures.data, f.salaryStructureId]);
  React.useEffect(() => {
    const ctc = Number(f.base);
    if (!open || !f.salaryStructureId || !(ctc > 0)) { setPv(null); return; }
    const t = setTimeout(() => runPreview({ salaryStructureId: f.salaryStructureId, ctc, employeeId }, { onSuccess: setPv, onError: () => setPv(null) }), 300);
    return () => clearTimeout(t);
  }, [open, f.salaryStructureId, f.base, employeeId, runPreview]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Salary structure & revisions</CardTitle>{canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Assign / revise</Button>}</CardHeader>
      <CardContent>
        <DataTable bare rows={list.data} loading={list.isLoading} error={list.error} rowKey={(a) => a.id} emptyTitle="No salary assigned" emptyDescription="Assign a structure and CTC so this employee is included in payroll." columns={[
          { key: 'f', header: 'Effective from', cell: (a) => formatDate(a.fromDate) }, { key: 's', header: 'Structure', cell: (a) => a.salaryStructure.name },
          { key: 'c', header: 'Annual CTC', cell: (a) => <span className="font-semibold tabular-nums">{formatINR(a.base)}</span>, align: 'right' }, { key: 'r', header: 'Tax regime', cell: (a) => (a.taxRegime === 'NEW' ? 'New' : 'Old') },
        ]} />
      </CardContent>
      <Modal open={open} onOpenChange={setOpen} size="lg" title="Assign salary" description="A revision applies from its effective date; earlier months are not recalculated."
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!pv || assign.isPending} onClick={() => assign.mutate({ employeeId, salaryStructureId: f.salaryStructureId, base: Number(f.base), fromDate: f.fromDate, taxRegime: f.taxRegime }, { onSuccess: () => setOpen(false) })}>{assign.isPending && <Spinner className="mr-2" />}Save</Button></>}>
        <div className="space-y-4">
          <FormGrid>
            <Field label="Salary structure"><NativeSelect value={f.salaryStructureId} onChange={(e) => setF({ ...f, salaryStructureId: e.target.value })}>{structures.data?.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
            <Field label="Annual CTC (₹)" htmlFor="ctc" required><Input id="ctc" type="number" min="1" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} /></Field>
            <Field label="Effective from" htmlFor="ef" required><Input id="ef" type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} /></Field>
            <Field label="Default tax regime"><NativeSelect value={f.taxRegime} onChange={(e) => setF({ ...f, taxRegime: e.target.value as TaxRegime })}><option value="NEW">New regime</option><option value="OLD">Old regime</option></NativeSelect></Field>
          </FormGrid>
          {pv && (
            <div className="rounded-md border">
              <table className="w-full text-caption"><thead className="bg-muted/50 text-fine uppercase text-muted-foreground"><tr><th className="px-3 py-2 text-left">Component</th><th className="px-3 py-2 text-right">Monthly</th><th className="px-3 py-2 text-right">Annual</th></tr></thead>
                <tbody className="divide-y">{pv.monthly.map((m) => <tr key={m.abbr}><td className="px-3 py-1.5">{m.name}</td><td className="px-3 py-1.5 text-right tabular-nums">{formatINR(m.monthly)}</td><td className="px-3 py-1.5 text-right tabular-nums">{formatINR(m.annual)}</td></tr>)}
                  <tr className="bg-muted/50 font-semibold"><td className="px-3 py-2">Gross</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(pv.grossMonthly)}</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(pv.grossAnnual)}</td></tr></tbody></table>
              <div className="grid gap-x-6 gap-y-1 border-t p-3 text-fine text-muted-foreground sm:grid-cols-2"><p>Employee PF {formatINR(pv.employee.pf)} · ESI {formatINR(pv.employee.esi)} / month</p><p>Employer PF {formatINR(pv.employer.pf)} · EDLI+admin {formatINR(pv.employer.edli + pv.employer.admin)} · ESI {formatINR(pv.employer.esi)} · gratuity {formatINR(pv.employer.gratuity)}</p></div>
            </div>
          )}
        </div>
      </Modal>
    </Card>
  );
}
