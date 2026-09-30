'use client';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR, humanize } from '@/lib/format';
import type { TaxComparison, TaxResult } from '@/types/payroll';

function Regime({ r, best }: { r: TaxResult; best: boolean }) {
  const rows: [string, number][] = [['Gross taxable salary', r.grossIncome], ...Object.entries(r.deductionBreakup).filter(([, v]) => v > 0).map(([k, v]) => [humanize(k.replace(/([A-Z])/g, ' $1').trim()), -v] as [string, number]), ['Taxable income', r.taxableIncome], ['Tax on income', r.taxOnIncome]];
  if (r.rebate) rows.push(['Rebate u/s 87A', -r.rebate]);
  if (r.surcharge) rows.push(['Surcharge', r.surcharge]);
  rows.push(['Health & education cess (4%)', r.cess]);
  return (
    <Card className={best ? 'border-success' : ''}>
      <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>{r.regime === 'NEW' ? 'New regime' : 'Old regime'}</CardTitle>{best && <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Lower tax</Badge>}</CardHeader>
      <CardContent>
        <ul className="divide-y text-caption">{rows.map(([l, v]) => <li key={l} className="flex justify-between py-1.5"><span className="text-muted-foreground">{l}</span><span className="tabular-nums">{v < 0 ? `− ${formatINR(-v)}` : formatINR(v)}</span></li>)}</ul>
        <div className="mt-3 flex items-baseline justify-between border-t pt-3"><span className="text-caption font-semibold">Estimated annual tax</span><span className="text-tagline font-semibold tabular-nums">{formatINR(r.totalTax)}</span></div>
        <p className="mt-1 text-right text-fine text-muted-foreground">Effective rate {r.effectiveRate.toFixed(1)}%</p>
      </CardContent>
    </Card>
  );
}

export function RegimeComparison({ data }: { data: TaxComparison }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted p-4 text-caption"><span className="font-semibold">The {data.recommended === 'NEW' ? 'New' : 'Old'} regime is better for you by about {formatINR(data.saving)} a year</span>, based on your current CTC and declared investments.</div>
      <div className="grid gap-4 lg:grid-cols-2"><Regime r={data.old} best={data.recommended === 'OLD'} /><Regime r={data.new} best={data.recommended === 'NEW'} /></div>
      <ul className="list-disc pl-5 text-fine text-muted-foreground">{data.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
    </div>
  );
}
