'use client';
import * as React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';

/** Approve / reject pair; rejecting asks for an optional comment. */
export function DecisionButtons({ onApprove, onReject, busy, subject, requireReason }: { onApprove: (comment?: string) => void; onReject: (comment?: string) => void; busy?: boolean; subject: string; requireReason?: boolean }) {
  const [mode, setMode] = React.useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = React.useState('');
  const close = () => { setMode(null); setComment(''); };
  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode('reject')} className="text-destructive hover:text-destructive"><X className="mr-1 h-3.5 w-3.5" />Reject</Button>
        <Button size="sm" disabled={busy} onClick={() => setMode('approve')}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
      </div>
      <Modal open={!!mode} onOpenChange={(o) => !o && close()} size="sm" title={mode === 'approve' ? 'Approve request' : 'Reject request'} description={subject}
        footer={<><Button variant="outline" onClick={close}>Cancel</Button>
          <Button variant={mode === 'reject' ? 'destructive' : 'default'} disabled={busy || (mode === 'reject' && requireReason && !comment.trim())} onClick={() => { (mode === 'approve' ? onApprove : onReject)(comment.trim() || undefined); close(); }}>{busy && <Spinner className="mr-2" />}{mode === 'approve' ? 'Approve' : 'Reject'}</Button></>}>
        <Textarea placeholder={mode === 'reject' ? 'Reason (shared with the employee)' : 'Comment (optional)'} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" />
      </Modal>
    </>
  );
}
