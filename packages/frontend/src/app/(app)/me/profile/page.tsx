'use client';
import * as React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailList } from '@/components/common/detail-list';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { DocumentsCard } from '@/components/profile/documents-card';
import { SecurityCard } from '@/components/profile/security-card';
import { useMyProfile, useUpdateMyProfile } from '@/hooks/employees/use-employees';
import { useResign, useSeparations } from '@/hooks/lifecycle/use-lifecycle';
import { formatDate, todayISO } from '@/lib/format';
import type { Employee } from '@/types/employees';

function EditableDetails({ e }: { e: Employee }) {
  const update = useUpdateMyProfile();
  const [editing, setEditing] = React.useState(false);
  const [f, setF] = React.useState({ phone: e.phone ?? '', personalEmail: e.personalEmail ?? '', currentAddress: e.currentAddress ?? '', city: e.city ?? '', state: e.state ?? '', pincode: e.pincode ?? '', bloodGroup: e.bloodGroup ?? '', emergencyContactName: e.emergencyContactName ?? '', emergencyContactPhone: e.emergencyContactPhone ?? '', emergencyContactRelation: e.emergencyContactRelation ?? '' });
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: ev.target.value });
  if (!editing) {
    return (
      <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Contact & emergency</CardTitle><Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button></CardHeader><CardContent>
        <DetailList items={[{ label: 'Phone', value: e.phone }, { label: 'Personal email', value: e.personalEmail }, { label: 'Address', value: [e.currentAddress, e.city, e.state, e.pincode].filter(Boolean).join(', ') }, { label: 'Blood group', value: e.bloodGroup },
          { label: 'Emergency contact', value: e.emergencyContactName ? `${e.emergencyContactName} (${e.emergencyContactRelation ?? '-'}) · ${e.emergencyContactPhone ?? ''}` : null }]} />
      </CardContent></Card>
    );
  }
  return (
    <Card><CardHeader><CardTitle>Edit contact & emergency details</CardTitle></CardHeader><CardContent>
      <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); update.mutate(f as Partial<Employee>, { onSuccess: () => setEditing(false) }); }}>
        <FormGrid><Field label="Phone" htmlFor="p1"><Input id="p1" value={f.phone} onChange={set('phone')} /></Field><Field label="Personal email" htmlFor="p2"><Input id="p2" type="email" value={f.personalEmail} onChange={set('personalEmail')} /></Field>
          <Field label="City" htmlFor="p3"><Input id="p3" value={f.city} onChange={set('city')} /></Field><Field label="State" htmlFor="p4"><Input id="p4" value={f.state} onChange={set('state')} /></Field>
          <Field label="Pincode" htmlFor="p5"><Input id="p5" value={f.pincode} onChange={set('pincode')} /></Field><Field label="Blood group" htmlFor="p6"><Input id="p6" value={f.bloodGroup} onChange={set('bloodGroup')} /></Field></FormGrid>
        <Field label="Current address" htmlFor="p7"><Textarea id="p7" value={f.currentAddress} onChange={set('currentAddress')} /></Field>
        <FormGrid cols={3}><Field label="Emergency contact" htmlFor="p8"><Input id="p8" value={f.emergencyContactName} onChange={set('emergencyContactName')} /></Field><Field label="Relation" htmlFor="p9"><Input id="p9" value={f.emergencyContactRelation} onChange={set('emergencyContactRelation')} /></Field><Field label="Phone" htmlFor="p10"><Input id="p10" value={f.emergencyContactPhone} onChange={set('emergencyContactPhone')} /></Field></FormGrid>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={update.isPending}>{update.isPending && <Spinner className="mr-2" />}Save</Button></div>
      </form>
    </CardContent></Card>
  );
}

function ResignCard({ e }: { e: Employee }) {
  const seps = useSeparations();
  const resign = useResign();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const mine = seps.data?.find((s) => s.employeeId === e.id);
  return (
    <Card><CardHeader><CardTitle>Resignation</CardTitle></CardHeader><CardContent className="space-y-3 text-caption">
      {mine ? (
        <div className="space-y-2"><div className="flex items-center gap-2"><StatusBadge status={mine.status} label={mine.status === 'PENDING' ? 'Awaiting approval' : 'Accepted'} /><span className="text-muted-foreground">Last working day: <b className="text-foreground">{formatDate(mine.lastWorkingDate)}</b></span></div>
          {mine.status === 'APPROVED' && <p className="text-muted-foreground">Clearance: {mine.clearances.filter((c) => c.status !== 'PENDING').length}/{mine.clearances.length} departments cleared.</p>}</div>
      ) : (
        <><p className="text-muted-foreground">Your notice period is {e.noticeperiodDays ?? 30} days. Your manager and HR will review the request.</p><Button variant="outline" onClick={() => setOpen(true)}><LogOut className="mr-2 h-4 w-4" />Submit resignation</Button></>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Submit resignation" description={`Proposed last working day: ${formatDate(new Date(Date.now() + (e.noticeperiodDays ?? 30) * 86400000))}`}>
        <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); resign.mutate({ reason }, { onSuccess: () => setOpen(false) }); }}>
          <Field label="Reason" htmlFor="rs" required><Textarea id="rs" required minLength={3} value={reason} onChange={(ev) => setReason(ev.target.value)} /></Field>
          <p className="text-fine text-muted-foreground">Filed on {formatDate(todayISO())}. This cannot be undone here. Speak to HR to withdraw.</p>
          <div className="flex justify-end"><Button type="submit" variant="destructive" disabled={resign.isPending}>Submit resignation</Button></div>
        </form>
      </Modal>
    </CardContent></Card>
  );
}

export default function ProfilePage() {
  const q = useMyProfile();
  return (
    <>
      <PageHeader title="My profile" description="Your employment record, documents and account security." />
      <QueryBoundary query={q} rows={6}>
        {(e) => (
          <Tabs defaultValue="overview">
            <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="security">Security</TabsTrigger><TabsTrigger value="exit">Exit</TabsTrigger></TabsList>
            <TabsContent value="overview" className="mt-4 space-y-6">
              <Card><CardHeader><CardTitle>Employment</CardTitle></CardHeader><CardContent><DetailList cols={3} items={[
                { label: 'Employee ID', value: e.employeeCode }, { label: 'Name', value: e.fullName }, { label: 'Work email', value: e.email }, { label: 'Department', value: e.department?.name }, { label: 'Designation', value: e.designation?.name },
                { label: 'Reporting manager', value: e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : null }, { label: 'Date of joining', value: formatDate(e.dateOfJoining) }, { label: 'Employment type', value: e.employmentType },
                { label: 'Location', value: e.workLocation }, { label: 'Date of birth', value: formatDate(e.dateOfBirth) }, { label: 'Gender', value: e.gender }, { label: 'Notice period', value: `${e.noticeperiodDays ?? 30} days` },
              ]} /></CardContent></Card>
              <Card><CardHeader><CardTitle>Statutory & bank <span className="ml-2 text-fine font-normal text-muted-foreground">Aadhaar is always shown masked</span></CardTitle></CardHeader><CardContent><DetailList cols={3} items={[
                { label: 'PAN', value: e.panNumber }, { label: 'Aadhaar', value: e.aadhaarNumber }, { label: 'UAN', value: e.uanNumber }, { label: 'Bank', value: e.bankName }, { label: 'Account number', value: e.bankAccountNumber }, { label: 'IFSC', value: e.ifscCode },
              ]} /><p className="mt-3 text-fine text-muted-foreground">To change bank or statutory details, raise a helpdesk ticket so HR can verify supporting documents.</p></CardContent></Card>
              <EditableDetails e={e} />
            </TabsContent>
            <TabsContent value="documents" className="mt-4"><DocumentsCard employeeId={e.id} /></TabsContent>
            <TabsContent value="security" className="mt-4"><SecurityCard /></TabsContent>
            <TabsContent value="exit" className="mt-4"><ResignCard e={e} /></TabsContent>
          </Tabs>
        )}
      </QueryBoundary>
    </>
  );
}
