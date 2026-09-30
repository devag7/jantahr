'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryBoundary } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { useConsents, useSetConsent } from '@/hooks/privacy/use-privacy';
import { formatDate } from '@/lib/format';
import { NOTICE_SECTIONS } from './privacy.constants';

export function PrivacyNoticeCard() {
  const q = useConsents();
  const set = useSetConsent();
  return (
    <Card>
      <CardHeader>
        <CardTitle>How your data is used</CardTitle>
        <CardDescription>Privacy notice for employees, version {q.data?.noticeVersion ?? '…'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTICE_SECTIONS.map((s) => (
          <div key={s.title}><h3 className="text-caption font-semibold">{s.title}</h3><p className="mt-1 text-caption text-muted-foreground">{s.body}</p></div>
        ))}
        <QueryBoundary query={q} rows={1}>
          {(d) => {
            const n = d.purposes.find((p) => p.purpose === 'PRIVACY_NOTICE');
            if (!n) return null;
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-caption"><StatusBadge status={n.state} label={n.state === 'GRANTED' ? 'Acknowledged' : n.state === 'OUTDATED' ? 'New version to review' : 'Not acknowledged'} />{n.at && <span className="text-muted-foreground">on {formatDate(n.at)}</span>}</div>
                {n.state !== 'GRANTED' && <Button size="sm" disabled={set.isPending} onClick={() => set.mutate({ purpose: 'PRIVACY_NOTICE', granted: true })}>I have read this notice</Button>}
              </div>
            );
          }}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

export function ConsentPanel() {
  const q = useConsents();
  const set = useSetConsent();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Optional data uses</CardTitle>
        <CardDescription>You can change these at any time. Withdrawing takes effect immediately and never affects your pay.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryBoundary query={q} rows={3}>
          {(d) => (
            <ul className="divide-y">
              {d.purposes.filter((p) => !p.required).map((p) => {
                const allowed = p.state !== 'WITHDRAWN';
                return (
                  <li key={p.purpose} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="font-semibold">{p.label}</p><StatusBadge status={allowed ? 'GRANTED' : 'WITHDRAWN'} label={allowed ? 'On' : 'Off'} /></div>
                      <p className="mt-1 text-caption text-muted-foreground">{p.description}</p>
                      {p.at && <p className="mt-1 text-fine text-muted-foreground">Last changed {formatDate(p.at)}</p>}
                    </div>
                    <Button size="sm" variant={allowed ? 'outline' : 'default'} disabled={set.isPending} onClick={() => set.mutate({ purpose: p.purpose, granted: !allowed })}>{allowed ? 'Turn off' : 'Turn on'}</Button>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}
