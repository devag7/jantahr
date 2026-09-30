'use client';
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { useErase } from '@/hooks/privacy/use-privacy';
import { formatDate } from '@/lib/format';
import type { ErasureResult, RetentionRow } from '@/types/privacy';

const ERASES_PARTIAL = ['Contact details, addresses, family & emergency contacts', 'Aadhaar number and profile photo', 'Check-in selfies, GPS coordinates and IPs', 'Non-KYC documents, sessions and notifications'];
const KEEPS_PARTIAL = ['Name, work email, date of birth', 'PAN, bank account, UAN / ESIC / PF numbers and KYC documents', 'Payroll, leave and attendance records'];

/** Irreversible: the person must type the employee code before the button enables. */
export function EraseModal({ row, requestId, onOpenChange }: { row: RetentionRow | null; requestId?: string; onOpenChange: (o: boolean) => void }) {
  const erase = useErase();
  const [code, setCode] = React.useState('');
  const [result, setResult] = React.useState<ErasureResult | null>(null);
  React.useEffect(() => { setCode(''); setResult(null); }, [row?.id]);
  const full = row?.plan.level === 'FULL';
  const close = (o: boolean) => { if (!o) setResult(null); onOpenChange(o); };
  return (
    <Modal open={!!row} onOpenChange={close} title={result ? 'Erasure complete' : `Erase ${row?.firstName ?? ''} ${row?.lastName ?? ''}`.trim()} description={row ? `${row.employeeCode} · left ${row.lastWorkingDate ? formatDate(row.lastWorkingDate) : '(date not recorded)'}` : undefined}>
      {row && result && (
        <div className="space-y-3 text-caption">
          <p>{result.level === 'FULL' ? 'The record was fully anonymised.' : 'Personal data was erased. Statutory records are retained.'}</p>
          <div><p className="font-semibold">Erased</p><ul className="ml-5 list-disc text-muted-foreground">{result.erased.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><p className="font-semibold">Retained</p><ul className="ml-5 list-disc text-muted-foreground">{result.retained.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="flex justify-end"><Button onClick={() => close(false)}>Done</Button></div>
        </div>
      )}
      {row && !result && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); erase.mutate({ employeeId: row.id, confirmEmployeeCode: code, requestId }, { onSuccess: setResult }); }}>
          <div className="flex gap-2 rounded-md border bg-muted p-3 text-caption"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p><strong>This cannot be undone.</strong> {row.plan.reason}</p></div>
          {full ? (
            <p className="text-caption text-muted-foreground">Name, email, date of birth, PAN, bank and PF/ESI identifiers are removed and the login account is rewritten. Only the employee code and non-identifying payroll amounts remain.</p>
          ) : (
            <div className="grid gap-3 text-caption sm:grid-cols-2">
              <div><p className="font-semibold">Will be erased</p><ul className="ml-4 list-disc text-muted-foreground">{ERASES_PARTIAL.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><p className="font-semibold">Kept for legal retention{row.plan.retainUntil ? ` until ${formatDate(row.plan.retainUntil)}` : ''}</p><ul className="ml-4 list-disc text-muted-foreground">{KEEPS_PARTIAL.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
          )}
          <Field label={`Type ${row.employeeCode} to confirm`} htmlFor="ec" required><Input id="ec" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder={row.employeeCode} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button><Button type="submit" variant="destructive" disabled={erase.isPending || code.trim() !== row.employeeCode}>{erase.isPending && <Spinner className="mr-2" />}{full ? 'Anonymise permanently' : 'Erase personal data'}</Button></div>
        </form>
      )}
    </Modal>
  );
}
