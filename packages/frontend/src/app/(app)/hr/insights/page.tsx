'use client';
import * as React from 'react';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { useAnomalies, useAttritionRisk } from '@/hooks/ai/use-ai';
import { useAuth } from '@/hooks/auth/use-auth';
import { ADMIN } from '@/lib/permissions';
import { humanize } from '@/lib/format';

const SEVERITY = { high: 'destructive', medium: 'warning', low: 'muted' } as const;
const RISK = { HIGH: 'destructive', MEDIUM: 'warning', LOW: 'success' } as const;

function Method({ text }: { text: string }) {
  return <p className="mb-4 flex items-start gap-2 rounded-md border bg-muted p-3 text-fine"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />{text}</p>;
}

function AnomaliesTab() {
  const [days, setDays] = React.useState(30);
  const q = useAnomalies(days);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><NativeSelect aria-label="Window" className="w-40" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}</NativeSelect></div>
      <QueryBoundary query={q}>{(d) => (<><Method text={d.method} />
        <DataTable rows={d.findings} rowKey={(f) => `${f.type}${f.employeeCode}${f.detail}`} dense emptyTitle="No anomalies detected" emptyDescription="Nothing unusual in the selected window." columns={[
          { key: 's', header: 'Severity', cell: (f) => <Badge variant={SEVERITY[f.severity]}>{humanize(f.severity)}</Badge> }, { key: 't', header: 'Signal', cell: (f) => humanize(f.type) },
          { key: 'e', header: 'Employee', cell: (f) => <div><p className="font-semibold">{f.employee}</p><p className="text-fine text-muted-foreground">{f.employeeCode}</p></div> }, { key: 'd', header: 'Detail', cell: (f) => f.detail },
        ]} /></>)}</QueryBoundary>
    </div>
  );
}

function AttritionTab() {
  const q = useAttritionRisk();
  return (
    <QueryBoundary query={q}>{(d) => (
      <div className="space-y-4"><Method text={d.method} />
        <div className="grid grid-cols-3 gap-3"><StatCard label="High risk" value={d.summary.high} tone="destructive" /><StatCard label="Medium" value={d.summary.medium} tone="warning" /><StatCard label="Low" value={d.summary.low} tone="success" /></div>
        <div className="grid gap-3 lg:grid-cols-2">{d.employees.filter((e) => e.score > 0).slice(0, 12).map((e) => (
          <Card key={e.employeeId}><CardHeader className="flex-row items-start justify-between space-y-0 pb-2"><div><CardTitle>{e.name}</CardTitle><p className="mt-1 text-fine text-muted-foreground">{e.designation ?? '-'} · {e.department ?? '-'} · {e.employeeCode}</p></div><Badge variant={RISK[e.risk]}>{e.risk.toLowerCase()} · {e.score}</Badge></CardHeader>
            <CardContent><Progress value={e.score} tone={e.risk === 'HIGH' ? 'destructive' : e.risk === 'MEDIUM' ? 'warning' : 'success'} /><ul className="mt-3 space-y-1 text-fine text-muted-foreground">{e.factors.map((f) => <li key={f.factor} className="flex justify-between gap-2"><span>{f.factor}</span><span>+{f.points}</span></li>)}</ul></CardContent></Card>
        ))}</div>
      </div>
    )}</QueryBoundary>
  );
}

export default function InsightsPage() {
  const { hasRole } = useAuth();
  return (
    <>
      <PageHeader title="People analytics" description="Explainable signals to start conversations, not automated decisions." />
      <Tabs defaultValue="anomalies"><TabsList><TabsTrigger value="anomalies">Attendance anomalies</TabsTrigger>{hasRole(ADMIN) && <TabsTrigger value="attrition">Attrition risk</TabsTrigger>}</TabsList>
        <TabsContent value="anomalies" className="mt-4"><AnomaliesTab /></TabsContent>{hasRole(ADMIN) && <TabsContent value="attrition" className="mt-4"><AttritionTab /></TabsContent>}</Tabs>
    </>
  );
}
