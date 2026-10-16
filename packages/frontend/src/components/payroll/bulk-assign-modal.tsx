'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { useEmployees } from '@/hooks/employees/use-employees';
import { useAssignments, useBulkAssign } from '@/hooks/payroll/use-payroll';
import { formatINR } from '@/lib/format';
import type { SalaryStructure } from '@/types/payroll';

const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

/**
 * Puts many employees on one salary structure at once (setting up a company otherwise means one employee at a time).
 * Each person's pay is split from the CTC on their profile, so people without a CTC cannot be picked. Starts with
 * everyone who has no structure yet selected, and reports anyone the API could not assign, with the reason.
 */
export function BulkAssignModal({ structure, onClose }: { structure: SalaryStructure | null; onClose: () => void }) {
  const emps = useEmployees({ limit: 200, status: 'ACTIVE' });
  const assignments = useAssignments();
  const bulk = useBulkAssign();
  const [fromDate, setFromDate] = React.useState(monthStart);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<{ assigned: number; failed: { employeeId: string; reason: string }[] } | null>(null);
  const people = emps.data?.items ?? [];
  const hasStructure = React.useMemo(() => new Set(assignments.data?.map((a) => a.employeeId)), [assignments.data]);
  const ready = !!emps.data && !!assignments.data;

  // open: preselect everyone with a CTC and no structure yet
  React.useEffect(() => {
    if (!structure || !ready) return;
    setResult(null);
    setFromDate(monthStart());
    setPicked(new Set(people.filter((p) => p.ctc && !hasStructure.has(p.id)).map((p) => p.id)));
  }, [structure, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickable = people.filter((p) => !!p.ctc);
  const all = pickable.length > 0 && pickable.every((p) => picked.has(p.id));
  const toggle = (id: string, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const nameOf = (id: string) => { const p = people.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName} (${p.employeeCode})` : id; };
  const submit = () => structure && bulk.mutate({ salaryStructureId: structure.id, employeeIds: Array.from(picked), fromDate }, { onSuccess: setResult });

  return (
    <Modal open={!!structure} onOpenChange={(o) => !o && onClose()} size="lg" title={structure ? `Assign ${structure.name}` : 'Assign'}
      description="Each person's monthly pay is split by this structure from the CTC on their profile, from the start date."
      footer={result
        ? <Button onClick={onClose}>Done</Button>
        : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!picked.size || !fromDate || bulk.isPending} onClick={submit}>{bulk.isPending && <Spinner />}Assign to {picked.size} {picked.size === 1 ? 'person' : 'people'}</Button></>}>
      {result ? (
        <div className="space-y-3 text-caption" role="status">
          <p className="text-body">{result.assigned} {result.assigned === 1 ? 'person is' : 'people are'} now on {structure?.name}.</p>
          {result.failed.length > 0 && (
            <div className="rounded-md border p-4">
              <p className="font-semibold">Not assigned ({result.failed.length})</p>
              <ul className="mt-2 space-y-1">{result.failed.map((f) => <li key={f.employeeId}>{nameOf(f.employeeId)}: <span className="text-muted-foreground">{f.reason}</span></li>)}</ul>
            </div>
          )}
        </div>
      ) : !ready ? (
        <div className="flex justify-center py-10"><Spinner className="h-5 w-5 text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <Field label="Start date" htmlFor="ba-from" required hint="Payroll from this month uses the new split."><Input id="ba-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-48" /></Field>
          <div className="rounded-md border">
            <label className="flex min-h-11 items-center gap-3 border-b px-4 text-caption font-semibold">
              <Checkbox checked={all} onCheckedChange={(on) => setPicked(on ? new Set(pickable.map((p) => p.id)) : new Set())} />Everyone with a CTC ({pickable.length})
            </label>
            <ul className="max-h-80 divide-y overflow-y-auto">
              {people.map((p) => (
                <li key={p.id}>
                  <label className={`flex min-h-11 items-center gap-3 px-4 py-1.5 text-caption ${p.ctc ? '' : 'text-muted-foreground'}`}>
                    <Checkbox checked={picked.has(p.id)} disabled={!p.ctc} onCheckedChange={(on) => toggle(p.id, on)} />
                    <span className="min-w-0 flex-1"><span className="font-semibold">{p.firstName} {p.lastName}</span> <span className="text-muted-foreground">{p.employeeCode}</span>
                      {hasStructure.has(p.id) && <span className="block text-fine text-muted-foreground">Already has a salary structure; this replaces it from the start date</span>}</span>
                    <span className="shrink-0 tabular">{p.ctc ? `${formatINR(p.ctc)} a year` : 'No CTC on profile'}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {emps.data && emps.data.total > people.length && <p className="text-fine text-muted-foreground">Showing the first {people.length} of {emps.data.total} active employees.</p>}
        </div>
      )}
    </Modal>
  );
}
