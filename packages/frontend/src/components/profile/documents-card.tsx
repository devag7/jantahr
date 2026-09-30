'use client';
import * as React from 'react';
import { BadgeCheck, Download, FileText, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { useAddDocument, useEmployeeDocuments, useRemoveDocument, useVerifyDocument } from '@/hooks/employees/use-employees';
import { errorMessage } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { employeesService } from '@/services/employees/employees.service';

const DOC_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Offer letter', 'Appointment letter', 'Education certificate', 'Experience letter', 'Address proof', 'Bank proof', 'Other'];

/** Employee document vault. `canVerify` is for HR. */
export function DocumentsCard({ employeeId, canVerify, canUpload = true }: { employeeId: string; canVerify?: boolean; canUpload?: boolean }) {
  const q = useEmployeeDocuments(employeeId);
  const add = useAddDocument(employeeId);
  const remove = useRemoveDocument(employeeId);
  const verify = useVerifyDocument(employeeId);
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState(DOC_TYPES[0]);
  const [expiry, setExpiry] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append('file', file); form.append('documentType', type); form.append('documentName', `${type}: ${file.name}`); if (expiry) form.append('expiryDate', expiry);
    add.mutate(form, { onSuccess: () => { setOpen(false); setFile(null); setExpiry(''); } });
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Documents</CardTitle>{canUpload && <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Upload className="mr-2 h-4 w-4" />Upload</Button>}</CardHeader>
      <CardContent>
        <QueryBoundary query={q} empty={{ when: (d) => d.length === 0, title: 'No documents uploaded', description: 'Upload ID proofs, certificates and letters (PDF/JPG/PNG, up to 10 MB).' }}>
          {(docs) => (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><p className="truncate text-caption font-semibold">{d.documentName}</p><p className="text-fine text-muted-foreground">{d.documentType} · uploaded {formatDate(d.createdAt)}{d.expiryDate && ` · expires ${formatDate(d.expiryDate)}`}</p></div>
                  {d.verifiedAt ? <Badge variant="success"><BadgeCheck className="mr-1 h-3 w-3" />Verified</Badge> : canVerify ? <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)}>Verify</Button> : <Badge variant="muted">Pending review</Badge>}
                  <Button size="icon" variant="ghost" aria-label="Download" onClick={() => employeesService.downloadDocument(d.id, d.documentName).catch((e) => toast.error(errorMessage(e)))}><Download className="h-4 w-4" /></Button>
                  {(!d.verifiedAt || canVerify) && canUpload && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>}
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
      <Modal open={open} onOpenChange={setOpen} title="Upload document" size="sm">
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Document type"><NativeSelect value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>
          <Field label="File" htmlFor="df" required><Input id="df" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <Field label="Expiry date (if any)" htmlFor="de"><Input id="de" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
          <div className="flex justify-end"><Button type="submit" disabled={!file || add.isPending}>{add.isPending && <Spinner className="mr-2" />}Upload</Button></div>
        </form>
      </Modal>
    </Card>
  );
}
