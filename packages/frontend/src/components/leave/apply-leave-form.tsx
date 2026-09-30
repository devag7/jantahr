'use client';
import * as React from 'react';
import { AlertCircle, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormGrid } from '@/components/common/field';
import { Spinner } from '@/components/common/states';
import { useApplyLeave, useLeaveBalance, useLeavePreview, useLeaveTypes } from '@/hooks/leave/use-leave';
import { errorMessage } from '@/lib/api/client';
import { formatDate, todayISO } from '@/lib/format';
import type { LeavePreview } from '@/types/leave';

/** Apply-leave form with a live server-side day count (holidays, weekly offs, sandwich rule, half-day). */
export function ApplyLeaveForm({ onDone, employeeId }: { onDone?: () => void; employeeId?: string }) {
  const types = useLeaveTypes();
  const balance = useLeaveBalance(employeeId);
  const preview = useLeavePreview();
  const apply = useApplyLeave();
  const [f, setF] = React.useState({ leaveTypeId: '', fromDate: todayISO(), toDate: todayISO(), halfDay: false, halfDayDate: '', reason: '' });
  const [previewData, setPreviewData] = React.useState<LeavePreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  // Offer only leave types the employee holds a balance for (plus unpaid leave); default to the everyday ones.
  const options = React.useMemo(() => (types.data ?? []).filter((t) => t.isLWP || balance.data?.some((b) => b.leaveTypeId === t.id)), [types.data, balance.data]);
  React.useEffect(() => {
    if (f.leaveTypeId || !options.length) return;
    const preferred = ['Casual Leave', 'Privilege Leave', 'Sick Leave'].map((n) => options.find((t) => t.name === n)).find(Boolean);
    setF((s) => ({ ...s, leaveTypeId: (preferred ?? options[0]).id }));
  }, [options, f.leaveTypeId]);

  const { mutate: runPreview } = preview;
  React.useEffect(() => {
    if (!f.leaveTypeId || !f.fromDate || !f.toDate || f.toDate < f.fromDate) { setPreviewData(null); return; }
    const t = setTimeout(() => runPreview({ leaveTypeId: f.leaveTypeId, fromDate: f.fromDate, toDate: f.toDate, halfDay: f.halfDay, halfDayDate: f.halfDay ? f.halfDayDate || f.fromDate : undefined, employeeId }, {
      onSuccess: (d) => { setPreviewData(d); setPreviewError(null); }, onError: (e) => { setPreviewData(null); setPreviewError(errorMessage(e)); },
    }), 250);
    return () => clearTimeout(t);
  }, [f.leaveTypeId, f.fromDate, f.toDate, f.halfDay, f.halfDayDate, employeeId, runPreview]);

  const selected = types.data?.find((t) => t.id === f.leaveTypeId);
  const bal = balance.data?.find((b) => b.leaveTypeId === f.leaveTypeId);
  const insufficient = !!previewData && !!selected && !selected.isLWP && !selected.allowNegativeBalance && previewData.totalDays > previewData.available;

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      apply.mutate({ leaveTypeId: f.leaveTypeId, fromDate: f.fromDate, toDate: f.toDate, halfDay: f.halfDay, halfDayDate: f.halfDay ? f.halfDayDate || f.fromDate : undefined, reason: f.reason || undefined, employeeId }, { onSuccess: () => onDone?.() });
    }}>
      <Field label="Leave type" htmlFor="lt" required hint={bal ? `${bal.available} day(s) available` : undefined}>
        <NativeSelect id="lt" value={f.leaveTypeId} onChange={(e) => setF({ ...f, leaveTypeId: e.target.value })}>{options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect>
      </Field>
      <FormGrid>
        <Field label="From" htmlFor="lf" required><Input id="lf" type="date" required value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value, toDate: e.target.value > f.toDate ? e.target.value : f.toDate })} /></Field>
        <Field label="To" htmlFor="lto" required><Input id="lto" type="date" required min={f.fromDate} value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></Field>
      </FormGrid>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-caption"><Checkbox checked={f.halfDay} onCheckedChange={(c) => setF({ ...f, halfDay: c })} />Half day</label>
        {f.halfDay && f.fromDate !== f.toDate && <Input type="date" aria-label="Half-day date" className="w-44" min={f.fromDate} max={f.toDate} value={f.halfDayDate || f.fromDate} onChange={(e) => setF({ ...f, halfDayDate: e.target.value })} />}
      </div>
      <div aria-live="polite">
        {previewData && (
          <div className={`flex items-start gap-3 rounded-md border p-3 text-caption ${insufficient ? 'border-destructive/60 bg-muted' : 'bg-muted'}`}>
            {insufficient ? <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" /> : <CalendarRange className="mt-0.5 h-4 w-4 text-primary" />}
            <div>
              <p className="font-semibold">{previewData.totalDays} day(s) will be deducted{insufficient && `: only ${previewData.available} available`}</p>
              {previewData.excludedDates.length > 0 && <p className="text-fine text-muted-foreground">Not counted (holiday / weekly off): {previewData.excludedDates.map((d) => formatDate(d, false)).join(', ')}</p>}
              {selected?.sandwichRule && <p className="text-fine text-muted-foreground">Sandwich rule: holidays and weekly offs between your leave days count as leave.</p>}
            </div>
          </div>
        )}
        {previewError && <p role="alert" className="text-caption text-destructive">{previewError}</p>}
      </div>
      <Field label="Reason" htmlFor="lr"><Textarea id="lr" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Optional: visible to your approver" /></Field>
      <div className="flex justify-end gap-2">{onDone && <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>}<Button type="submit" disabled={apply.isPending || !!previewError || insufficient || !previewData}>{apply.isPending && <Spinner className="mr-2" />}Submit request</Button></div>
    </form>
  );
}
