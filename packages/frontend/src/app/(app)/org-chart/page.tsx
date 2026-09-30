'use client';
import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { UserAvatar } from '@/components/common/user-avatar';
import { useOrgChart } from '@/hooks/employees/use-employees';
import type { OrgNode } from '@/types/employees';

function Node({ n, depth }: { n: OrgNode; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2);
  const has = n.children.length > 0;
  return (
    <li>
      <div className="flex items-center gap-2 rounded-md py-1.5 pr-3 hover:bg-muted/60">
        {has ? <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${n.name}`} className="rounded-sm p-0.5 hover:bg-muted">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button> : <span className="w-5" />}
        <UserAvatar name={n.name} className="h-9 w-9" />
        <div className="min-w-0"><p className="truncate text-caption font-semibold">{n.name} <span className="font-normal text-muted-foreground">· {n.employeeCode}</span></p><p className="truncate text-fine text-muted-foreground">{[n.designation, n.department].filter(Boolean).join(' · ')}</p></div>
        {has && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-fine text-muted-foreground">{n.children.length}</span>}
      </div>
      {has && open && <ul className="ml-4 border-l pl-4">{n.children.map((c) => <Node key={c.id} n={c} depth={depth + 1} />)}</ul>}
    </li>
  );
}

export default function OrgChartPage() {
  const q = useOrgChart();
  return (
    <>
      <PageHeader title="Organisation chart" description="Reporting lines across the company." />
      <QueryBoundary query={q} empty={{ when: (d) => d.length === 0, title: 'No employees yet' }}>{(roots) => <ul className="space-y-1 rounded-md border bg-card p-4">{roots.map((r) => <Node key={r.id} n={r} depth={0} />)}</ul>}</QueryBoundary>
    </>
  );
}
