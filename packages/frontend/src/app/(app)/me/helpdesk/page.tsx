'use client';
import * as React from 'react';
import { Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useCommentTicket, useCreateTicket, useTicket, useTicketCategories, useTickets, useUpdateTicket } from '@/hooks/helpdesk/use-helpdesk';
import { formatDateTime } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import type { Ticket, TicketPriority, TicketStatus } from '@/types/helpdesk';

export default function HelpdeskPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(ADMIN);
  const [scope, setScope] = React.useState<'mine' | 'all'>('mine');
  const [create, setCreate] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | undefined>();
  const tickets = useTickets(scope);
  return (
    <>
      <PageHeader title="Helpdesk" description="Raise a question or issue with HR, payroll or IT." actions={<>{isAdmin && <NativeSelect aria-label="Scope" className="w-40" value={scope} onChange={(e) => setScope(e.target.value as 'mine' | 'all')}><option value="mine">My tickets</option><option value="all">All tickets</option></NativeSelect>}<Button onClick={() => setCreate(true)}><Plus className="mr-2 h-4 w-4" />New ticket</Button></>} />
      <DataTable rows={tickets.data} loading={tickets.isLoading} error={tickets.error} rowKey={(t) => t.id} onRowClick={(t) => setOpenId(t.id)} emptyTitle="No tickets" emptyDescription="Raise a ticket and HR will respond here."
        columns={[
          { key: 's', header: 'Subject', cell: (t) => <div><p className="font-semibold">{t.subject}</p>{scope === 'all' && <p className="text-fine text-muted-foreground">{t.employee.firstName} {t.employee.lastName}</p>}</div> },
          { key: 'c', header: 'Category', cell: (t) => t.category, hideOnMobile: true },
          { key: 'p', header: 'Priority', cell: (t) => <StatusBadge status={t.priority} /> },
          { key: 'st', header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
          { key: 'd', header: 'Raised', cell: (t) => formatDateTime(t.createdAt), hideOnMobile: true },
        ]} />
      <NewTicketModal open={create} onOpenChange={setCreate} />
      <TicketModal id={openId} onClose={() => setOpenId(undefined)} isAdmin={isAdmin} />
    </>
  );
}

function NewTicketModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const cats = useTicketCategories();
  const create = useCreateTicket();
  const [f, setF] = React.useState<{ subject: string; description: string; category: string; priority: TicketPriority }>({ subject: '', description: '', category: 'Payroll', priority: 'MEDIUM' });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Raise a ticket">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(f, { onSuccess: () => { setF({ ...f, subject: '', description: '' }); onOpenChange(false); } }); }}>
        <Field label="Subject" htmlFor="ts" required><Input id="ts" required minLength={3} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <FormGrid>
          <Field label="Category"><NativeSelect value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.data?.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
          <Field label="Priority"><NativeSelect value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TicketPriority })}>{(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}</NativeSelect></Field>
        </FormGrid>
        <Field label="Describe the issue" htmlFor="td" required><Textarea id="td" required minLength={3} rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Submit ticket</Button></div>
      </form>
    </Modal>
  );
}

function TicketModal({ id, onClose, isAdmin }: { id?: string; onClose: () => void; isAdmin: boolean }) {
  const q = useTicket(id);
  const comment = useCommentTicket();
  const update = useUpdateTicket();
  const [msg, setMsg] = React.useState('');
  const t: Ticket | undefined = q.data;
  return (
    <Modal open={!!id} onOpenChange={(o) => !o && onClose()} size="lg" title={t?.subject ?? 'Ticket'} description={t ? `${t.category} · raised ${formatDateTime(t.createdAt)}` : undefined}>
      <QueryBoundary query={q}>
        {(tk) => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={tk.status} /><StatusBadge status={tk.priority} />
              {isAdmin && <NativeSelect aria-label="Change status" className="ml-auto w-40" value={tk.status} onChange={(e) => update.mutate({ id: tk.id, status: e.target.value as TicketStatus })}>{(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</NativeSelect>}
              {!isAdmin && tk.status !== 'CLOSED' && <Button size="sm" variant="outline" className="ml-auto" onClick={() => update.mutate({ id: tk.id, status: 'CLOSED' })}>Close ticket</Button>}</div>
            <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-caption">{tk.description}</p>
            <ul className="space-y-3">{tk.comments?.map((c) => <li key={c.id} className="rounded-md border p-3 text-caption"><p className="mb-1 text-fine text-muted-foreground"><b className="text-foreground">{c.authorName}</b> · {formatDateTime(c.createdAt)}</p>{c.message}</li>)}</ul>
            {tk.status !== 'CLOSED' && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); comment.mutate({ id: tk.id, message: msg }, { onSuccess: () => setMsg('') }); }}>
                <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a reply…" aria-label="Reply" /><Button type="submit" size="icon" disabled={!msg.trim() || comment.isPending} aria-label="Send reply"><Send className="h-4 w-4" /></Button>
              </form>
            )}
          </div>
        )}
      </QueryBoundary>
    </Modal>
  );
}
