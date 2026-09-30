'use client';
import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DownloadButton } from '@/components/common/download-button';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, QueryBoundary, Spinner } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { useCustomCatalog, useMisCatalog, useMisReport, useRunCustomReport } from '@/hooks/reports/use-reports';
import { humanize, MONTH_NAMES, todayISO } from '@/lib/format';
import { reportsService } from '@/services/reports/reports.service';
import type { CustomReportInput, CustomReportResult, MisReport } from '@/types/reports';

function ResultTable({ columns, rows }: { columns: { key: string; label: string }[]; rows: Record<string, string | number | null>[] }) {
  if (!rows.length) return <EmptyState title="No rows" description="Nothing matches these parameters." />;
  return (
    <div className="max-h-[32rem] overflow-auto rounded-md border">
      <table className="w-full text-caption"><thead className="sticky top-0 bg-muted text-fine uppercase tracking-wide text-muted-foreground"><tr>{columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{c.label}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.slice(0, 500).map((r, i) => <tr key={i} className="hover:bg-muted/50">{columns.map((c) => <td key={c.key} className="whitespace-nowrap px-3 py-1.5">{r[c.key] === null || r[c.key] === undefined ? '-' : typeof r[c.key] === 'number' ? Number(r[c.key]).toLocaleString('en-IN') : String(r[c.key])}</td>)}</tr>)}</tbody></table>
      {rows.length > 500 && <p className="border-t p-2 text-center text-fine text-muted-foreground">Showing first 500 of {rows.length} rows: download CSV for everything.</p>}
    </div>
  );
}

function MisTab() {
  const catalog = useMisCatalog();
  const [key, setKey] = React.useState<string | null>(null);
  const now = new Date();
  const [params, setParams] = React.useState<Record<string, string>>({ year: String(now.getFullYear()), month: String(now.getMonth() + 1), from: '', to: '', by: 'department', fy: '' });
  const item = catalog.data?.find((c) => c.key === key);
  const active = React.useMemo(() => Object.fromEntries((item?.params ?? []).map((p) => [p, params[p] || undefined])), [item, params]);
  const report = useMisReport(key, active);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setParams({ ...params, [k]: e.target.value });
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <Card className="h-fit"><CardHeader><CardTitle>Reports</CardTitle></CardHeader><CardContent className="space-y-0.5 p-2">
        <QueryBoundary query={catalog}>{(list) => <>{list.map((c) => <button key={c.key} onClick={() => setKey(c.key)} className={`w-full rounded-md px-3 py-2 text-left text-caption hover:bg-muted ${key === c.key ? 'bg-accent font-semibold' : ''}`}><span className="block">{c.title}</span><span className="block text-fine text-muted-foreground">{c.description}</span></button>)}</>}</QueryBoundary>
      </CardContent></Card>
      <div className="min-w-0 space-y-4">
        {!item ? <EmptyState title="Pick a report" description="MIS reports respect your access level; sensitive columns are hidden unless you have payroll access." /> : (
          <>
            <div className="flex flex-wrap items-end gap-3"><h2 className="mr-auto text-tagline font-semibold">{item.title}</h2>
              {item.params.includes('month') && <NativeSelect aria-label="Month" className="w-36" value={params.month} onChange={set('month')}>{MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</NativeSelect>}
              {item.params.includes('year') && <Input aria-label="Year" type="number" className="w-24" value={params.year} onChange={set('year')} />}
              {item.params.includes('fy') && <Input aria-label="Financial year start" type="number" placeholder="FY start e.g. 2026" className="w-40" value={params.fy} onChange={set('fy')} />}
              {item.params.includes('from') && <Input aria-label="From" type="date" className="w-40" max={todayISO()} value={params.from} onChange={set('from')} />}
              {item.params.includes('to') && <Input aria-label="To" type="date" className="w-40" value={params.to} onChange={set('to')} />}
              {item.params.includes('by') && <NativeSelect aria-label="Group by" className="w-40" value={params.by} onChange={set('by')}>{['department', 'designation', 'location', 'type'].map((b) => <option key={b} value={b}>By {b}</option>)}</NativeSelect>}
              {item.params.includes('status') && <NativeSelect aria-label="Status" className="w-36" value={params.status ?? ''} onChange={set('status')}><option value="">All</option><option value="ACTIVE">Active</option><option value="LEFT">Left</option></NativeSelect>}
              <DownloadButton variant="outline" onDownload={() => reportsService.downloadMis(item.key, active)}>CSV</DownloadButton></div>
            <QueryBoundary query={report}>{(r: MisReport) => (
              <>
                {r.summary && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(r.summary).filter(([, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 4).map(([k, v]) => <StatCard key={k} label={humanize(k.replace(/([A-Z])/g, '_$1'))} value={typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)} />)}</div>}
                <ResultTable columns={r.columns.map((c) => ({ key: c, label: humanize(c) }))} rows={r.rows} />
              </>
            )}</QueryBoundary>
          </>
        )}
      </div>
    </div>
  );
}

function CustomTab() {
  const catalog = useCustomCatalog();
  const run = useRunCustomReport();
  const [entity, setEntity] = React.useState('employees');
  const [cols, setCols] = React.useState<string[]>(['employee_code', 'name', 'department']);
  const [filters, setFilters] = React.useState<{ field: string; op: 'eq' | 'contains' | 'gte' | 'lte'; value: string }[]>([]);
  const [sortBy, setSortBy] = React.useState('');
  const [result, setResult] = React.useState<CustomReportResult | null>(null);
  const ent = catalog.data?.find((e) => e.entity === entity);
  const input: CustomReportInput = { entity, columns: cols, filters: filters.filter((f) => f.field && f.value), sortBy: sortBy || undefined };
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Card className="h-fit"><CardHeader><CardTitle>Build a report</CardTitle></CardHeader><CardContent className="space-y-4">
        <NativeSelect aria-label="Data source" value={entity} onChange={(e) => { setEntity(e.target.value); setCols([]); setFilters([]); setSortBy(''); setResult(null); }}>{catalog.data?.map((e) => <option key={e.entity} value={e.entity}>{e.label}</option>)}</NativeSelect>
        <div><p className="mb-1 text-fine font-semibold uppercase text-muted-foreground">Columns</p><div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-caption">{ent?.fields.map((f) => <label key={f.key} className="flex items-center gap-2"><Checkbox checked={cols.includes(f.key)} onCheckedChange={(c) => setCols(c ? [...cols, f.key] : cols.filter((x) => x !== f.key))} />{f.label}</label>)}</div></div>
        <div><p className="mb-1 text-fine font-semibold uppercase text-muted-foreground">Filters</p>
          <div className="space-y-2">{filters.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_5.5rem_1fr_auto] gap-1"><NativeSelect aria-label="Field" value={f.field} onChange={(e) => setFilters(filters.map((x, k) => (k === i ? { ...x, field: e.target.value } : x)))}><option value="">Field…</option>{ent?.fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</NativeSelect>
              <NativeSelect aria-label="Operator" value={f.op} onChange={(e) => setFilters(filters.map((x, k) => (k === i ? { ...x, op: e.target.value as typeof f.op } : x)))}><option value="eq">=</option><option value="contains">has</option><option value="gte">≥</option><option value="lte">≤</option></NativeSelect>
              <Input aria-label="Value" value={f.value} onChange={(e) => setFilters(filters.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} /><Button variant="ghost" size="icon" aria-label="Remove filter" onClick={() => setFilters(filters.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button></div>
          ))}<Button variant="outline" size="sm" onClick={() => setFilters([...filters, { field: '', op: 'eq', value: '' }])}>Add filter</Button></div></div>
        <NativeSelect aria-label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="">No sorting</option>{cols.map((c) => <option key={c} value={c}>Sort by {ent?.fields.find((f) => f.key === c)?.label}</option>)}</NativeSelect>
        <Button className="w-full" disabled={!cols.length || run.isPending} onClick={() => run.mutate(input, { onSuccess: setResult })}>{run.isPending && <Spinner className="mr-2" />}Run report</Button>
      </CardContent></Card>
      <div className="min-w-0 space-y-3">
        {result ? (<><div className="flex items-center justify-between"><p className="text-caption text-muted-foreground">{result.total} row(s){result.truncated && ' (truncated at 5,000)'}</p>
          <Button variant="outline" size="sm" onClick={() => { const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`; const csv = [result.columns.map((c) => esc(c.label)).join(','), ...result.rows.map((r) => result.columns.map((c) => esc(r[c.key])).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${entity}-report.csv`; a.click(); }}>Download CSV</Button></div>
          <ResultTable columns={result.columns} rows={result.rows} /></>) : <EmptyState title="Configure and run" description="Choose columns and filters, then run. Only fields you're permitted to see are offered." />}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="MIS reports and a custom report builder: export to CSV." />
      <Tabs defaultValue="mis"><TabsList><TabsTrigger value="mis">MIS reports</TabsTrigger><TabsTrigger value="custom">Custom builder</TabsTrigger></TabsList>
        <TabsContent value="mis" className="mt-4"><MisTab /></TabsContent><TabsContent value="custom" className="mt-4"><CustomTab /></TabsContent></Tabs>
    </>
  );
}
