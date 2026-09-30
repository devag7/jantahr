'use client';
import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/common/modal';
import { Spinner } from '@/components/common/states';
import { useImportEmployees } from '@/hooks/employees/use-employees';
import type { ImportResult } from '@/types/employees';

const TEMPLATE = 'firstName,lastName,email,gender,dateOfJoining,department,designation,ctc,phone,panNumber,uanNumber,bankName,bankAccountNumber,ifscCode\nAsha,Rao,asha.rao@company.com,FEMALE,2026-10-01,Engineering,Software Engineer,1200000,9876543210,,,,,\n';

export function ImportEmployeesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const imp = useImportEmployees();
  const [csv, setCsv] = React.useState('');
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const readFile = async (f?: File) => { if (f) setCsv(await f.text()); };
  const downloadTemplate = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' })); a.download = 'employee-import-template.csv'; a.click(); };
  return (
    <Modal open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setResult(null); setCsv(''); } }} size="lg" title="Import employees from CSV" description="Departments and designations are created if they don't exist. Each employee gets a temporary password.">
      {!result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button><label className="cursor-pointer text-caption text-primary hover:underline"><Upload className="mr-1 inline h-4 w-4" />Choose CSV file<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} /></label></div>
          <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Paste CSV here (header row required)" className="font-mono text-fine" aria-label="CSV data" />
          <div className="flex justify-end"><Button disabled={csv.trim().length < 10 || imp.isPending} onClick={() => imp.mutate(csv, { onSuccess: setResult })}>{imp.isPending && <Spinner className="mr-2" />}Import</Button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-caption"><b className="text-success">{result.createdCount} created</b>{result.failedCount > 0 && <> · <b className="text-destructive">{result.failedCount} failed</b></>}</p>
          {result.failed.length > 0 && <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted p-3 text-fine">{result.failed.map((f) => <li key={f.row}>Row {f.row}{f.email ? ` (${f.email})` : ''}: {f.error}</li>)}</ul>}
          {result.created.length > 0 && (<div><p className="mb-1 text-fine font-semibold text-muted-foreground">Temporary passwords: share securely; users must change them at first sign-in</p><div className="max-h-48 overflow-y-auto rounded-md border"><table className="w-full text-fine"><tbody>{result.created.map((c) => <tr key={c.row} className="border-b last:border-0"><td className="px-3 py-1.5">{c.employeeCode}</td><td className="px-3 py-1.5">{c.email}</td><td className="px-3 py-1.5 font-mono">{c.temporaryPassword}</td></tr>)}</tbody></table></div></div>)}
          <div className="flex justify-end"><Button onClick={() => onOpenChange(false)}>Done</Button></div>
        </div>
      )}
    </Modal>
  );
}
