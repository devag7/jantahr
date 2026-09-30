'use client';
import * as React from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { useAcknowledgePolicy, usePolicies } from '@/hooks/engagement/use-engagement';
import { formatDate } from '@/lib/format';

export default function PoliciesPage() {
  const q = usePolicies();
  const ack = useAcknowledgePolicy();
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <>
      <PageHeader title="Company policies" description="Read and acknowledge policies. You'll be asked again when a policy changes." />
      <QueryBoundary query={q} empty={{ when: (d) => d.length === 0, title: 'No policies published yet' }}>
        {(policies) => (
          <div className="space-y-3">
            {policies.filter((p) => p.isActive).map((p) => (
              <Card key={p.id}>
                <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
                  <div className="min-w-0"><p className="font-semibold">{p.title}</p><p className="text-fine text-muted-foreground">{p.category} · version {p.version} · updated {formatDate(p.updatedAt)}</p></div>
                  <div className="flex items-center gap-3">{p.acknowledged ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Acknowledged</Badge> : <Badge variant="warning">Action needed</Badge>}<ChevronDown className={`h-4 w-4 transition-transform ${open === p.id ? 'rotate-180' : ''}`} /></div>
                </button>
                {open === p.id && (
                  <div className="border-t p-4"><p className="whitespace-pre-line text-caption leading-relaxed">{p.content}</p>{!p.acknowledged && <Button className="mt-4" size="sm" disabled={ack.isPending} onClick={() => ack.mutate(p.id)}>I have read and understood this policy</Button>}</div>
                )}
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </>
  );
}
