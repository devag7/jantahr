'use client';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/common/data-table';
import { DownloadButton } from '@/components/common/download-button';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { usePrivacyRequests, useRetention, useUpdatePrivacyRequest } from '@/hooks/privacy/use-privacy';
import { formatDate } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import { privacyService } from '@/services/privacy/privacy.service';
import type { AdminPrivacyRequest, PrivacyRequestStatus } from '@/types/privacy';
import { EraseModal } from './erase-modal';
import { REQUEST_LABEL } from './privacy.constants';

export function AdminRequests() {
  const [status, setStatus] = React.useState('');
  const [open, setOpen] = React.useState<AdminPrivacyRequest | null>(null);
  const q = usePrivacyRequests(status || undefined);
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><NativeSelect aria-label="Status" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></NativeSelect></div>
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(r) => r.id} onRowClick={setOpen} emptyTitle="No privacy requests" emptyDescription="Requests from employees to access, correct or erase their data appear here."
        columns={[
          { key: 'e', header: 'Employee', cell: (r) => r.employee ? <div><p className="font-semibold">{r.employee.firstName} {r.employee.lastName}</p><p className="text-fine text-muted-foreground">{r.employee.employeeCode}</p></div> : '-' },
          { key: 't', header: 'Request', cell: (r) => <div><p>{REQUEST_LABEL[r.type]}</p><p className="line-clamp-1 max-w-xs text-fine text-muted-foreground">{r.details}</p></div> },
          { key: 'd', header: 'Respond by', cell: (r) => <span>{formatDate(r.dueDate)} {r.overdue && <Badge variant="destructive" className="ml-1">Overdue</Badge>}</span>, hideOnMobile: true },
          { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
        ]} />
      <RequestModal req={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function RequestModal({ req, onClose }: { req: AdminPrivacyRequest | null; onClose: () => void }) {
  const { hasRole } = useAuth();
  const canAct = hasRole(ADMIN);
  const update = useUpdatePrivacyRequest();
  const retention = useRetention();
  const [status, setStatus] = React.useState<PrivacyRequestStatus>('IN_PROGRESS');
  const [resolution, setResolution] = React.useState('');
  const [erasing, setErasing] = React.useState(false);
  React.useEffect(() => { if (req) { setStatus(req.status === 'OPEN' ? 'IN_PROGRESS' : req.status); setResolution(req.resolution ?? ''); } }, [req]);
  const closed = req?.status === 'COMPLETED' || req?.status === 'REJECTED';
  const leaver = req?.type === 'ERASURE' ? retention.data?.employees.find((e) => e.id === req.employeeId) : undefined;
  return (
    <>
      <Modal open={!!req && !erasing} onOpenChange={(o) => !o && onClose()} title={req ? REQUEST_LABEL[req.type] : ''} description={req?.employee ? `${req.employee.firstName} ${req.employee.lastName} · ${req.employee.employeeCode} · raised ${formatDate(req.createdAt)}` : undefined}>
        {req && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-caption">{req.details}</p>
            {canAct && <div className="flex flex-wrap gap-2">
              <DownloadButton variant="outline" size="sm" onDownload={() => privacyService.exportFor(req.employeeId)}>Export their data</DownloadButton>
              {req.type === 'ERASURE' && !closed && <Button size="sm" variant="outline" disabled={!leaver?.plan.allowed} title={leaver?.plan.allowed ? undefined : 'Only employees who have left can be erased'} onClick={() => setErasing(true)}>Review erasure…</Button>}
            </div>}
            {closed ? (
              <div className="space-y-1 text-caption"><StatusBadge status={req.status} /><p className="text-muted-foreground">{req.resolution}</p>{req.resolvedAt && <p className="text-fine text-muted-foreground">Closed {formatDate(req.resolvedAt)}</p>}</div>
            ) : canAct ? (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); update.mutate({ id: req.id, status, resolution: resolution || undefined }, { onSuccess: onClose }); }}>
                <Field label="Status"><NativeSelect value={status} onChange={(e) => setStatus(e.target.value as PrivacyRequestStatus)}><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></NativeSelect></Field>
                <Field label="Resolution note" htmlFor="rn" hint="Required to complete or reject. The employee sees this."><Textarea id="rn" value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Close</Button><Button type="submit" disabled={update.isPending}>{update.isPending && <Spinner className="mr-2" />}Save</Button></div>
              </form>
            ) : null}
          </div>
        )}
      </Modal>
      <EraseModal row={erasing && leaver ? leaver : null} requestId={req?.id} onOpenChange={(o) => { if (!o) { setErasing(false); onClose(); } }} />
    </>
  );
}

