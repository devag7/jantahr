'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/common/data-table';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { useCreatePrivacyRequest, useMyPrivacyRequests } from '@/hooks/privacy/use-privacy';
import { formatDate } from '@/lib/format';
import type { PrivacyRequestType } from '@/types/privacy';
import { REQUEST_LABEL, REQUEST_TYPES } from './privacy.constants';

export function MyRequests() {
  const list = useMyPrivacyRequests();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-body font-semibold">My requests</h2><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New request</Button></div>
      <DataTable rows={list.data} loading={list.isLoading} error={list.error} rowKey={(r) => r.id} emptyTitle="No privacy requests" emptyDescription="Ask to access, correct or erase your data, or raise a grievance."
        columns={[
          { key: 't', header: 'Request', cell: (r) => <div><p className="font-semibold">{REQUEST_LABEL[r.type]}</p><p className="line-clamp-1 text-fine text-muted-foreground">{r.details}</p></div> },
          { key: 'd', header: 'Raised', cell: (r) => formatDate(r.createdAt), hideOnMobile: true },
          { key: 'due', header: 'Respond by', cell: (r) => formatDate(r.dueDate), hideOnMobile: true },
          { key: 's', header: 'Status', cell: (r) => <div><StatusBadge status={r.status} />{r.resolution && <p className="mt-1 max-w-xs text-fine text-muted-foreground">{r.resolution}</p>}</div> },
        ]} />
      <NewRequestModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewRequestModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreatePrivacyRequest();
  const [type, setType] = React.useState<PrivacyRequestType>('CORRECTION');
  const [details, setDetails] = React.useState('');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New privacy request" description="Goes to HR. You will be notified when it is updated.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ type, details }, { onSuccess: () => { setDetails(''); onOpenChange(false); } }); }}>
        <Field label="Request type" hint={REQUEST_TYPES.find((t) => t.value === type)?.hint}>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as PrivacyRequestType)}>{REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</NativeSelect>
        </Field>
        <Field label="Details" htmlFor="pd" required hint="At least 10 characters."><Textarea id="pd" required minLength={10} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe what you need" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending && <Spinner className="mr-2" />}Submit</Button></div>
      </form>
    </Modal>
  );
}
