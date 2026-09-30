'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { useCreateRequest } from '@/hooks/attendance/use-attendance';
import { todayISO } from '@/lib/format';
import type { RequestType } from '@/types/attendance';

const TYPES: { value: RequestType; label: string; hint: string }[] = [
  { value: 'REGULARIZE', label: 'Regularize attendance', hint: 'Missed punch or forgot to check in/out on a past day' },
  { value: 'WFH', label: 'Work from home', hint: 'Mark the day as work-from-home' },
  { value: 'ON_DUTY', label: 'On duty (client visit / travel)', hint: 'Working outside the office for business' },
];

export function AttendanceRequestModal({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (o: boolean) => void; defaultDate?: string }) {
  const create = useCreateRequest();
  const [type, setType] = React.useState<RequestType>('REGULARIZE');
  const [from, setFrom] = React.useState(defaultDate ?? todayISO());
  const [to, setTo] = React.useState('');
  const [half, setHalf] = React.useState(false);
  const [reason, setReason] = React.useState('');
  React.useEffect(() => { if (open && defaultDate) setFrom(defaultDate); }, [open, defaultDate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ fromDate: from, toDate: to || undefined, requestType: type, halfDay: half, reason }, { onSuccess: () => { setReason(''); setTo(''); onOpenChange(false); } });
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Attendance request" description="Your manager will be asked to approve this.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Request type" hint={TYPES.find((t) => t.value === type)?.hint}>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as RequestType)}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</NativeSelect>
        </Field>
        <FormGrid>
          <Field label="From" htmlFor="rf" required><Input id="rf" type="date" required value={from} max={type === 'REGULARIZE' ? todayISO() : undefined} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To (optional)" htmlFor="rt"><Input id="rt" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </FormGrid>
        <label className="flex items-center gap-2 text-caption"><Checkbox checked={half} onCheckedChange={setHalf} />Half day</label>
        <Field label="Reason" htmlFor="rr" required><Textarea id="rr" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check out; was in the client meeting" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending && <Spinner className="mr-2" />}Submit request</Button></div>
      </form>
    </Modal>
  );
}
