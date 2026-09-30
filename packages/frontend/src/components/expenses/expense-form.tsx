'use client';
import * as React from 'react';
import { Paperclip, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { useCreateClaim, useExpenseCategories, useUploadReceipt } from '@/hooks/expenses/use-expenses';
import { errorMessage } from '@/lib/api/client';
import { formatINR, todayISO } from '@/lib/format';

interface Row { expenseDate: string; category: string; description: string; amount: string; receiptUrl?: string; receiptName?: string }
const blank = (category: string): Row => ({ expenseDate: todayISO(), category, description: '', amount: '' });

export function ExpenseClaimModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const cats = useExpenseCategories();
  const create = useCreateClaim();
  const upload = useUploadReceipt();
  const [title, setTitle] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([blank('Travel')]);
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const attach = (i: number, file?: File) => {
    if (!file) return;
    upload.mutate(file, { onSuccess: (r) => setRow(i, { receiptUrl: r.receiptUrl, receiptName: r.name }), onError: (e) => toast.error(errorMessage(e)) });
  };
  const save = (submit: boolean) => create.mutate(
    { title, submit, items: rows.map((r) => ({ expenseDate: r.expenseDate, category: r.category, description: r.description || undefined, amount: Number(r.amount), receiptUrl: r.receiptUrl })) },
    { onSuccess: () => { setTitle(''); setRows([blank('Travel')]); onOpenChange(false); } },
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="xl" title="New expense claim" description="Add each expense with its receipt. Approved amounts are reimbursed with your next salary."
      footer={<><Button variant="outline" disabled={create.isPending || !title || total <= 0} onClick={() => save(false)}>Save draft</Button><Button disabled={create.isPending || !title || total <= 0} onClick={() => save(true)}>{create.isPending && <Spinner className="mr-2" />}Submit for approval</Button></>}>
      <div className="space-y-4">
        <Field label="Claim title" htmlFor="ct" required><Input id="ct" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client visit: Pune, Oct 2026" /></Field>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-[9rem_10rem_1fr_8rem_auto]">
              <Input type="date" aria-label="Date" max={todayISO()} value={r.expenseDate} onChange={(e) => setRow(i, { expenseDate: e.target.value })} />
              <NativeSelect aria-label="Category" value={r.category} onChange={(e) => setRow(i, { category: e.target.value })}>{cats.data?.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
              <Input aria-label="Description" placeholder="Description" value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} />
              <Input aria-label="Amount" type="number" min="1" placeholder="₹ Amount" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
              <div className="flex items-center gap-1">
                <label className="cursor-pointer rounded-md border p-2 hover:bg-muted" title={r.receiptName ?? 'Attach receipt'}><Paperclip className={`h-4 w-4 ${r.receiptUrl ? 'text-success' : ''}`} /><input type="file" className="sr-only" accept="image/*,application/pdf" onChange={(e) => attach(i, e.target.files?.[0])} aria-label="Attach receipt" /></label>
                {rows.length > 1 && <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label="Remove line"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between"><Button variant="outline" size="sm" onClick={() => setRows([...rows, blank(rows[rows.length - 1]?.category ?? 'Travel')])}><Plus className="mr-1 h-4 w-4" />Add line</Button><p className="text-caption">Total <b className="text-tagline tabular-nums">{formatINR(total)}</b></p></div>
      </div>
    </Modal>
  );
}
