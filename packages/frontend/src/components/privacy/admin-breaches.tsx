'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/common/data-table';
import { DetailList } from '@/components/common/detail-list';
import { Field, FormGrid } from '@/components/common/field';
import { ConfirmModal, Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useBreaches, useCreateBreach, useNotifyBreach, useUpdateBreach } from '@/hooks/privacy/use-privacy';
import { formatDate, formatDateTime } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import type { BreachSeverity, BreachStatus, DataBreach } from '@/types/privacy';

const SEVERITIES: BreachSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES: BreachStatus[] = ['INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'CLOSED'];

export function AdminBreaches() {
  const { hasRole } = useAuth();
  const canAct = hasRole(ADMIN);
  const q = useBreaches();
  const [logging, setLogging] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = q.data?.find((b) => b.id === openId) ?? null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">Register of personal-data incidents. DPDP s.8(6) and Rules r.7: tell affected people without delay and send the Data Protection Board a detailed report within 72 hours. This register tracks that you did: it does not file with the Board.</p>
        {canAct && <Button onClick={() => setLogging(true)}><Plus className="mr-2 h-4 w-4" />Log breach</Button>}
      </div>
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(b) => b.id} onRowClick={(b) => setOpenId(b.id)} emptyTitle="No breaches logged" emptyDescription="Good news: nothing has been recorded."
        columns={[
          { key: 't', header: 'Incident', cell: (b) => <div><p className="font-semibold">{b.title}</p><p className="text-fine text-muted-foreground">Detected {formatDate(b.detectedAt)}</p></div> },
          { key: 'sv', header: 'Severity', cell: (b) => <StatusBadge status={b.severity} /> },
          { key: 'a', header: 'Affected', cell: (b) => b.affectedCount ?? '-', align: 'right', hideOnMobile: true },
          { key: 'bd', header: 'Board report', cell: (b) => (b.boardNotifiedAt ? formatDate(b.boardNotifiedAt) : <span className={b.boardOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}>due {formatDateTime(b.boardDueAt)}{b.boardOverdue ? ' · overdue' : ''}</span>), hideOnMobile: true },
          { key: 's', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
        ]} />
      <LogBreachModal open={logging} onOpenChange={setLogging} />
      <BreachModal breach={open} canAct={canAct} onClose={() => setOpenId(null)} />
    </div>
  );
}

function LogBreachModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateBreach();
  const blank = { title: '', description: '', severity: 'MEDIUM' as BreachSeverity, affectedCount: '', dataCategories: '', containmentActions: '' };
  const [f, setF] = React.useState(blank);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Log a data breach" description="Super admins are notified immediately." size="lg">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ title: f.title, description: f.description, severity: f.severity, affectedCount: f.affectedCount ? Number(f.affectedCount) : undefined, dataCategories: f.dataCategories || undefined, containmentActions: f.containmentActions || undefined }, { onSuccess: () => { setF(blank); onOpenChange(false); } }); }}>
        <FormGrid>
          <Field label="Title" htmlFor="bt" required><Input id="bt" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Payslips emailed to wrong list" /></Field>
          <Field label="Severity"><NativeSelect value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as BreachSeverity })}>{SEVERITIES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</NativeSelect></Field>
          <Field label="People affected (approx.)" htmlFor="ba"><Input id="ba" type="number" min="0" value={f.affectedCount} onChange={(e) => setF({ ...f, affectedCount: e.target.value })} /></Field>
          <Field label="Data involved" htmlFor="bc"><Input id="bc" value={f.dataCategories} onChange={(e) => setF({ ...f, dataCategories: e.target.value })} placeholder="e.g. Name, salary, bank account" /></Field>
        </FormGrid>
        <Field label="What happened" htmlFor="bd" required><Textarea id="bd" required minLength={10} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Containment actions so far" htmlFor="bx"><Textarea id="bx" value={f.containmentActions} onChange={(e) => setF({ ...f, containmentActions: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending && <Spinner className="mr-2" />}Log breach</Button></div>
      </form>
    </Modal>
  );
}

function BreachModal({ breach, canAct, onClose }: { breach: DataBreach | null; canAct: boolean; onClose: () => void }) {
  const update = useUpdateBreach();
  const notify = useNotifyBreach();
  const [confirm, setConfirm] = React.useState(false);
  const [status, setStatus] = React.useState<BreachStatus>('INVESTIGATING');
  const [actions, setActions] = React.useState('');
  React.useEffect(() => { if (breach) { setStatus(breach.status); setActions(breach.containmentActions ?? ''); } }, [breach]);
  const closed = breach?.status === 'CLOSED';
  return (
    <>
      <Modal open={!!breach} onOpenChange={(o) => !o && onClose()} title={breach?.title ?? ''} description={breach ? `Detected ${formatDateTime(breach.detectedAt)}` : undefined} size="lg">
        {breach && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-caption">{breach.description}</p>
            <DetailList cols={2} items={[
              { label: 'Severity', value: <StatusBadge status={breach.severity} /> }, { label: 'Status', value: <StatusBadge status={breach.status} /> },
              { label: 'People affected', value: breach.affectedCount ?? '-' }, { label: 'Data involved', value: breach.dataCategories ?? '-' },
              { label: 'Data Protection Board notified', value: breach.boardNotifiedAt ? formatDateTime(breach.boardNotifiedAt) : 'Not yet' }, { label: 'Employees notified', value: breach.principalsNotifiedAt ? formatDateTime(breach.principalsNotifiedAt) : 'Not yet' },
            ]} />
            {canAct && !closed && (
              <>
                <div className="flex flex-wrap gap-2">
                  {!breach.boardNotifiedAt && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: breach.id, boardNotified: true })}>Record: Board notified</Button>}
                  {!breach.principalsNotifiedAt && <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>Notify all employees…</Button>}
                </div>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); update.mutate({ id: breach.id, status, containmentActions: actions || undefined }, { onSuccess: onClose }); }}>
                  <Field label="Status"><NativeSelect value={status} onChange={(e) => setStatus(e.target.value as BreachStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</NativeSelect></Field>
                  <Field label="Containment actions" htmlFor="bca"><Textarea id="bca" value={actions} onChange={(e) => setActions(e.target.value)} /></Field>
                  <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Close</Button><Button type="submit" disabled={update.isPending}>{update.isPending && <Spinner className="mr-2" />}Save</Button></div>
                </form>
              </>
            )}
          </div>
        )}
      </Modal>
      <ConfirmModal open={confirm} onOpenChange={setConfirm} title="Notify every active employee?" description="Sends an in-app and email notice about this incident to all active employees. This cannot be recalled." confirmLabel="Send notice" loading={notify.isPending}
        onConfirm={() => breach && notify.mutate(breach.id, { onSuccess: () => setConfirm(false) })} />
    </>
  );
}
