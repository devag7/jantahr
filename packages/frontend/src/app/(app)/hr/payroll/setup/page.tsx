'use client';
import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEmployees } from '@/hooks/employees/use-employees';
import { useAdditional, useCloseLoan, useComponents, useCreateAdditional, useCreateComponent, useCreateLoan, useCreateStructure, useDeleteAdditional, useDeleteComponent, useDeleteStructure, useLoans, usePreviewStructure, useStructures } from '@/hooks/payroll/use-payroll';
import { formatDate, formatINR, todayISO } from '@/lib/format';
import { PAYROLL } from '@/lib/permissions';
import type { StructurePreview } from '@/types/payroll';

export default function PayrollSetupPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole(PAYROLL);
  return (
    <>
      <PageHeader title="Salary setup" description="Components, CTC structures, one-time pay & recoveries, and loans." />
      <Tabs defaultValue="structures">
        <TabsList><TabsTrigger value="structures">Structures</TabsTrigger><TabsTrigger value="components">Components</TabsTrigger><TabsTrigger value="additional">Bonus & recoveries</TabsTrigger><TabsTrigger value="loans">Loans & advances</TabsTrigger></TabsList>
        <TabsContent value="structures" className="mt-4"><StructuresTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="components" className="mt-4"><ComponentsTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="additional" className="mt-4"><AdditionalTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="loans" className="mt-4"><LoansTab canEdit={canEdit} /></TabsContent>
      </Tabs>
    </>
  );
}

function ComponentsTab({ canEdit }: { canEdit: boolean }) {
  const q = useComponents();
  const create = useCreateComponent();
  const del = useDeleteComponent();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ name: '', abbr: '', type: 'EARNING' as 'EARNING' | 'DEDUCTION', isTaxApplicable: true, isPfApplicable: false, isEsiApplicable: true, isPtApplicable: true, dependsOnPaymentDays: true, exemptionCode: '' as '' | 'CHILD_EDUCATION' | 'HOSTEL' | 'MEAL' });
  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New component</Button></div>}
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(c) => c.id} dense columns={[
        { key: 'n', header: 'Component', cell: (c) => <div><p className="font-semibold">{c.name}</p><p className="text-fine text-muted-foreground">{c.abbr}</p></div> }, { key: 't', header: 'Type', cell: (c) => <StatusBadge status={c.type === 'EARNING' ? 'ACTIVE' : 'CANCELLED'} label={c.type === 'EARNING' ? 'Earning' : 'Deduction'} /> },
        { key: 'f', header: 'Applies to', cell: (c) => <div className="flex flex-wrap gap-1">{c.isStatutory && <Badge variant="info">Statutory (auto)</Badge>}{c.isTaxApplicable && c.type === 'EARNING' && <Badge variant="muted">Taxable</Badge>}{c.isPfApplicable && <Badge variant="muted">PF wages</Badge>}{c.exemptionCode && <Badge variant="info">{c.exemptionCode === 'MEAL' ? 'Meal exemption' : c.exemptionCode === 'HOSTEL' ? 'Hostel exemption' : 'Education exemption'}</Badge>}{c.type === 'EARNING' && c.isEsiApplicable && <Badge variant="muted">ESI wages</Badge>}{c.dependsOnPaymentDays && c.type === 'EARNING' && <Badge variant="muted">Pro-rated</Badge>}</div> },
        { key: 'x', header: '', align: 'right', cell: (c) => canEdit && !c.isStatutory && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button> },
      ]} />
      <Modal open={open} onOpenChange={setOpen} title="New salary component">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ ...f, exemptionCode: f.exemptionCode || null }, { onSuccess: () => { setOpen(false); setF({ ...f, name: '', abbr: '' }); } }); }}>
          <FormGrid><Field label="Name" htmlFor="cn" required><Input id="cn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Conveyance Allowance" /></Field><Field label="Abbreviation" htmlFor="ca" required hint="Used in formulas, e.g. CONV"><Input id="ca" required value={f.abbr} onChange={(e) => setF({ ...f, abbr: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} /></Field></FormGrid>
          <Field label="Type"><NativeSelect value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'EARNING' | 'DEDUCTION' })}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></NativeSelect></Field>
          {f.type === 'EARNING' && <div className="grid gap-2 sm:grid-cols-2">{([['isTaxApplicable', 'Taxable'], ['isPfApplicable', 'Counts as PF wages'], ['isEsiApplicable', 'Counts as ESI wages'], ['isPtApplicable', 'Counts for professional tax'], ['dependsOnPaymentDays', 'Pro-rated by paid days']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-caption"><Checkbox checked={f[k]} onCheckedChange={(c) => setF({ ...f, [k]: c })} />{l}</label>)}</div>}
          {f.type === 'EARNING' && <Field label="Tax exemption" hint={f.exemptionCode === 'MEAL' ? '₹200 per meal (22 meals/month assumed), both regimes' : f.exemptionCode ? `Up to ₹${f.exemptionCode === 'HOSTEL' ? '9,000' : '3,000'} per child per month, max 2 children, old regime only` : 'Income-tax Rules 2026 limits'}><NativeSelect value={f.exemptionCode} onChange={(e) => setF({ ...f, exemptionCode: e.target.value as typeof f.exemptionCode })}><option value="">None: fully taxable</option><option value="CHILD_EDUCATION">Children's education allowance</option><option value="HOSTEL">Hostel expenditure allowance</option><option value="MEAL">Meal vouchers / food</option></NativeSelect></Field>}
          <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Create</Button></div>
        </form>
      </Modal>
    </div>
  );
}

interface StructRow { componentId: string; kind: 'formula' | 'amount'; value: string }

function StructuresTab({ canEdit }: { canEdit: boolean }) {
  const structures = useStructures();
  const comps = useComponents();
  const create = useCreateStructure();
  const del = useDeleteStructure();
  const preview = usePreviewStructure();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [rows, setRows] = React.useState<StructRow[]>([]);
  const [previewCtc, setPreviewCtc] = React.useState('1200000');
  const [pv, setPv] = React.useState<{ id: string; data: StructurePreview } | null>(null);
  const earnings = comps.data?.filter((c) => c.type === 'EARNING' && !c.isStatutory) ?? [];
  const addRow = () => setRows((r) => [...r, { componentId: earnings.find((c) => !r.some((x) => x.componentId === c.id))?.id ?? '', kind: 'formula', value: '' }]);
  const setRow = (i: number, p: Partial<StructRow>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const abbrs = rows.map((r) => earnings.find((c) => c.id === r.componentId)?.abbr).filter(Boolean);
  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button onClick={() => { setName(''); setRows([]); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />New structure</Button></div>}
      <DataTable rows={structures.data} loading={structures.isLoading} error={structures.error} rowKey={(s) => s.id} columns={[
        { key: 'n', header: 'Structure', cell: (s) => <div><p className="font-semibold">{s.name}</p><p className="text-fine text-muted-foreground">{s.description}</p></div> },
        { key: 'c', header: 'Components', cell: (s) => <div className="flex flex-wrap gap-1">{s.components.map((c) => <Badge key={c.id} variant="muted" title={c.formula ?? String(c.amount)}>{c.component.abbr}{c.formula ? ` = ${c.formula}` : ` ₹${c.amount}`}</Badge>)}</div> },
        { key: 'a', header: 'Employees', cell: (s) => s._count.assignments, align: 'right' },
        { key: 'x', header: '', align: 'right', cell: (s) => <div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => preview.mutate({ salaryStructureId: s.id, ctc: Number(previewCtc) || 1200000 }, { onSuccess: (d) => setPv({ id: s.id, data: d }) })}>Preview</Button>{canEdit && s._count.assignments === 0 && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}</div> },
      ]} />
      {pv && (
        <div className="rounded-md border p-4"><div className="mb-3 flex items-center gap-3"><b className="text-caption">Preview for CTC</b><Input type="number" className="w-40" value={previewCtc} onChange={(e) => setPreviewCtc(e.target.value)} aria-label="CTC" /><Button size="sm" variant="outline" onClick={() => preview.mutate({ salaryStructureId: pv.id, ctc: Number(previewCtc) || 1 }, { onSuccess: (d) => setPv({ id: pv.id, data: d }) })}>Recalculate</Button><button className="ml-auto text-fine text-muted-foreground hover:underline" onClick={() => setPv(null)}>Close</button></div>
          <table className="w-full text-caption"><tbody className="divide-y">{pv.data.monthly.map((m) => <tr key={m.abbr}><td className="py-1.5">{m.name} <span className="text-fine text-muted-foreground">({m.abbr})</span></td><td className="py-1.5 text-right tabular-nums">{formatINR(m.monthly)}/mo</td><td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatINR(m.annual)}/yr</td></tr>)}<tr className="font-semibold"><td className="py-2">Gross</td><td className="py-2 text-right tabular-nums">{formatINR(pv.data.grossMonthly)}</td><td className="py-2 text-right tabular-nums">{formatINR(pv.data.grossAnnual)}</td></tr></tbody></table></div>
      )}
      <Modal open={open} onOpenChange={setOpen} size="xl" title="New salary structure" description="Components are evaluated top to bottom. Formulas can use CTC, MONTHLY_CTC, ER_PF, GRATUITY and any component above (e.g. BASIC * 0.5; MAX(0, MONTHLY_CTC - BASIC - HRA - ER_PF - GRATUITY))."
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!name || !rows.length || create.isPending} onClick={() => create.mutate({ name, components: rows.map((r) => ({ componentId: r.componentId, ...(r.kind === 'formula' ? { formula: r.value } : { amount: Number(r.value) }) })) }, { onSuccess: () => setOpen(false) })}>{create.isPending && <Spinner className="mr-2" />}Save structure</Button></>}>
        <div className="space-y-4">
          <Field label="Structure name" htmlFor="sname" required><Input id="sname" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[12rem_8rem_1fr_auto]">
                <NativeSelect aria-label="Component" value={r.componentId} onChange={(e) => setRow(i, { componentId: e.target.value })}>{earnings.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.abbr})</option>)}</NativeSelect>
                <NativeSelect aria-label="Method" value={r.kind} onChange={(e) => setRow(i, { kind: e.target.value as 'formula' | 'amount' })}><option value="formula">Formula</option><option value="amount">Fixed ₹/month</option></NativeSelect>
                <Input aria-label="Formula or amount" placeholder={r.kind === 'formula' ? 'e.g. MONTHLY_CTC * 0.40' : 'e.g. 1600'} value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} className="font-mono text-caption" />
                <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addRow}><Plus className="mr-1 h-4 w-4" />Add component</Button>
            {abbrs.length > 0 && <p className="text-fine text-muted-foreground">Available in formulas: CTC, MONTHLY_CTC, ER_PF, GRATUITY, {abbrs.join(', ')}</p>}
          </div>
          <p className="text-fine text-muted-foreground">PF, ESI, professional tax, LWF and TDS are computed automatically and must not be added here.</p>
        </div>
      </Modal>
    </div>
  );
}

function AdditionalTab({ canEdit }: { canEdit: boolean }) {
  const q = useAdditional();
  const comps = useComponents();
  const emps = useEmployees({ limit: 200, status: 'ACTIVE' });
  const create = useCreateAdditional();
  const del = useDeleteAdditional();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ employeeId: '', salaryComponentId: '', amount: '', payrollDate: todayISO(), reason: '' });
  const usable = comps.data?.filter((c) => !c.isStatutory && c.componentType === 'ADDITIONAL') ?? [];
  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add bonus / recovery</Button></div>}
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(a) => a.id} dense emptyTitle="Nothing scheduled" emptyDescription="One-time bonuses, arrears, incentives and recoveries picked up by the payroll for their month." columns={[
        { key: 'e', header: 'Employee', cell: (a) => `${a.employee.firstName} ${a.employee.lastName} (${a.employee.employeeCode})` }, { key: 'c', header: 'Component', cell: (a) => a.salaryComponent.name }, { key: 'd', header: 'Payroll month', cell: (a) => formatDate(a.payrollDate) },
        { key: 'a', header: 'Amount', cell: (a) => <span className={a.type === 'DEDUCTION' ? 'text-destructive' : ''}>{a.type === 'DEDUCTION' ? '− ' : ''}{formatINR(a.amount)}</span>, align: 'right' }, { key: 'r', header: 'Reason', cell: (a) => a.reason ?? '-', hideOnMobile: true },
        { key: 'x', header: '', align: 'right', cell: (a) => canEdit && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button> },
      ]} />
      <Modal open={open} onOpenChange={setOpen} title="Add one-time pay / recovery">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ employeeId: f.employeeId, salaryComponentId: f.salaryComponentId || usable[0]?.id, amount: Number(f.amount), payrollDate: f.payrollDate, reason: f.reason || undefined }, { onSuccess: () => { setOpen(false); setF({ ...f, amount: '', reason: '' }); } }); }}>
          <Field label="Employee"><NativeSelect required value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{emps.data?.items.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}</NativeSelect></Field>
          <FormGrid><Field label="Type"><NativeSelect value={f.salaryComponentId || usable[0]?.id} onChange={(e) => setF({ ...f, salaryComponentId: e.target.value })}>{usable.map((c) => <option key={c.id} value={c.id}>{c.name}{c.type === 'DEDUCTION' ? ' (deduction)' : ''}</option>)}</NativeSelect></Field><Field label="Amount (₹)" htmlFor="aa"><Input id="aa" type="number" min="1" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Payroll month (any date in month)" htmlFor="ad"><Input id="ad" type="date" required value={f.payrollDate} onChange={(e) => setF({ ...f, payrollDate: e.target.value })} /></Field><Field label="Reason" htmlFor="ar"><Input id="ar" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field></FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Add</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function LoansTab({ canEdit }: { canEdit: boolean }) {
  const q = useLoans();
  const emps = useEmployees({ limit: 200, status: 'ACTIVE' });
  const create = useCreateLoan();
  const close = useCloseLoan();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ employeeId: '', loanType: 'LOAN' as 'LOAN' | 'ADVANCE', principal: '', totalInstallments: '6', startDate: todayISO(), reason: '' });
  return (
    <div className="space-y-4">
      {canEdit && <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New loan / advance</Button></div>}
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(l) => l.id} dense emptyTitle="No loans" columns={[
        { key: 'e', header: 'Employee', cell: (l) => `${l.employee.firstName} ${l.employee.lastName}` }, { key: 't', header: 'Type', cell: (l) => l.loanType.toLowerCase() }, { key: 'p', header: 'Principal', cell: (l) => formatINR(l.principal), align: 'right' },
        { key: 'm', header: 'EMI', cell: (l) => formatINR(l.emi), align: 'right' }, { key: 'i', header: 'Paid', cell: (l) => `${l.paidInstallments}/${l.totalInstallments}`, align: 'right' }, { key: 'o', header: 'Outstanding', cell: (l) => <b>{formatINR(l.outstanding)}</b>, align: 'right' },
        { key: 's', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> }, { key: 'x', header: '', align: 'right', cell: (l) => canEdit && l.status === 'ACTIVE' && <Button size="sm" variant="ghost" onClick={() => close.mutate(l.id)}>Close</Button> },
      ]} />
      <Modal open={open} onOpenChange={setOpen} title="New loan / advance" description="The EMI is deducted automatically each month from the start date until repaid.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ employeeId: f.employeeId, loanType: f.loanType, principal: Number(f.principal), totalInstallments: Number(f.totalInstallments), startDate: f.startDate, reason: f.reason || undefined }, { onSuccess: () => setOpen(false) }); }}>
          <Field label="Employee"><NativeSelect required value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{emps.data?.items.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}</NativeSelect></Field>
          <FormGrid><Field label="Type"><NativeSelect value={f.loanType} onChange={(e) => setF({ ...f, loanType: e.target.value as 'LOAN' | 'ADVANCE' })}><option value="LOAN">Loan</option><option value="ADVANCE">Salary advance</option></NativeSelect></Field><Field label="Amount (₹)" htmlFor="lp"><Input id="lp" type="number" min="1" required value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
            <Field label="Instalments" htmlFor="li" hint={f.principal && f.totalInstallments ? `EMI ≈ ${formatINR(Math.ceil(Number(f.principal) / Number(f.totalInstallments)))}` : undefined}><Input id="li" type="number" min="1" max="120" required value={f.totalInstallments} onChange={(e) => setF({ ...f, totalInstallments: e.target.value })} /></Field><Field label="First deduction month" htmlFor="ls"><Input id="ls" type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field></FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Create</Button></div>
        </form>
      </Modal>
    </div>
  );
}
