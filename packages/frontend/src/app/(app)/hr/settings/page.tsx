'use client';
import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { useAuth } from '@/hooks/auth/use-auth';
import { useAnnouncements, useCreateAnnouncement, useCreatePolicy, useDeleteAnnouncement, usePolicies, usePolicyAcks, useUpdatePolicy } from '@/hooks/engagement/use-engagement';
import { useCompany, useCreateDepartment, useCreateDesignation, useCreateHolidayList, useDeleteDepartment, useDeleteDesignation, useDeleteHolidayList, useDepartments, useDesignations, useHolidayLists, useStates, useUpdateCompany } from '@/hooks/org/use-org';
import { formatDate } from '@/lib/format';
import { INDIAN_STATES, WEEKDAYS } from '@/lib/india';
import type { CompanyProfile, HolidayItem } from '@/types/org';

export default function SettingsPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Settings" description={`${user?.company.name}: company profile, statutory configuration, organisation and communication.`} />
      <Tabs defaultValue="company">
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="company">Company & statutory</TabsTrigger><TabsTrigger value="org">Departments & designations</TabsTrigger><TabsTrigger value="holidays">Holidays</TabsTrigger><TabsTrigger value="announcements">Announcements</TabsTrigger><TabsTrigger value="policies">Policies</TabsTrigger></TabsList>
        <TabsContent value="company" className="mt-4"><CompanyTab /></TabsContent>
        <TabsContent value="org" className="mt-4"><OrgTab /></TabsContent>
        <TabsContent value="holidays" className="mt-4"><HolidaysTab /></TabsContent>
        <TabsContent value="announcements" className="mt-4"><AnnouncementsTab /></TabsContent>
        <TabsContent value="policies" className="mt-4"><PoliciesTab /></TabsContent>
      </Tabs>
    </>
  );
}

function CompanyForm({ c }: { c: CompanyProfile }) {
  const update = useUpdateCompany();
  const states = useStates();
  const [f, setF] = React.useState({ ...c });
  const set = (k: keyof CompanyProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const str = (v: string | null | undefined) => v ?? '';
  const flags = [['pfEnabled', 'Provident Fund (PF) applies'], ['esiEnabled', 'ESI applies'], ['ptEnabled', 'Professional tax applies'], ['lwfEnabled', 'Labour Welfare Fund applies'], ['isMetroCity', 'Head office is in a metro city (HRA 50%)']] as const;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...rest } = f;
    void id;
    const clean = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === '' ? undefined : v])) as Partial<CompanyProfile>;
    update.mutate(clean);
  };
  return (
    <form onSubmit={save} className="space-y-6">
      <Card><CardHeader><CardTitle>Company profile</CardTitle></CardHeader><CardContent><FormGrid cols={3}>
        <Field label="Display name" htmlFor="n"><Input id="n" value={str(f.name)} onChange={set('name')} /></Field><Field label="Legal name" htmlFor="ln"><Input id="ln" value={str(f.legalName)} onChange={set('legalName')} /></Field><Field label="CIN / registration no." htmlFor="rn"><Input id="rn" value={str(f.registrationNumber)} onChange={set('registrationNumber')} /></Field>
        <Field label="Phone" htmlFor="ph"><Input id="ph" value={str(f.phone)} onChange={set('phone')} /></Field><Field label="Email" htmlFor="em"><Input id="em" type="email" value={str(f.email)} onChange={set('email')} /></Field><Field label="Website" htmlFor="ws"><Input id="ws" value={str(f.website)} onChange={set('website')} /></Field>
        <Field label="Address" htmlFor="ad" className="sm:col-span-3"><Textarea id="ad" rows={2} value={str(f.address)} onChange={set('address')} /></Field>
        <Field label="City" htmlFor="ci"><Input id="ci" value={str(f.city)} onChange={set('city')} /></Field><Field label="State" htmlFor="st" hint="Default state for professional tax & LWF"><NativeSelect id="st" value={str(f.state)} onChange={set('state')}>{(states.data ?? INDIAN_STATES).map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field><Field label="Pincode" htmlFor="pc"><Input id="pc" value={str(f.pincode)} onChange={set('pincode')} /></Field>
      </FormGrid></CardContent></Card>
      <Card><CardHeader><CardTitle>Statutory registrations</CardTitle></CardHeader><CardContent><FormGrid cols={3}>
        <Field label="PAN" htmlFor="pan"><Input id="pan" value={str(f.pan)} onChange={set('pan')} className="uppercase" maxLength={10} /></Field><Field label="TAN" htmlFor="tan"><Input id="tan" value={str(f.tan)} onChange={set('tan')} className="uppercase" maxLength={10} /></Field><Field label="GSTIN" htmlFor="gst"><Input id="gst" value={str(f.gstin)} onChange={set('gstin')} className="uppercase" /></Field>
        <Field label="PF establishment code" htmlFor="pf"><Input id="pf" value={str(f.pfNumber)} onChange={set('pfNumber')} /></Field><Field label="ESI code" htmlFor="esi"><Input id="esi" value={str(f.esiNumber)} onChange={set('esiNumber')} /></Field><Field label="PT registration" htmlFor="pt"><Input id="pt" value={str(f.ptRegistration)} onChange={set('ptRegistration')} /></Field>
      </FormGrid></CardContent></Card>
      <Card><CardHeader><CardTitle>Payroll & attendance rules</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">{flags.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-caption"><Checkbox checked={!!f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} />{l}</label>)}</div>
        <div><p className="mb-2 text-caption font-semibold">Weekly offs</p><div className="flex flex-wrap gap-2">{WEEKDAYS.map((d, i) => { const on = f.weeklyOffDays.includes(i); return <button key={d} type="button" aria-pressed={on} onClick={() => setF({ ...f, weeklyOffDays: on ? f.weeklyOffDays.filter((x) => x !== i) : [...f.weeklyOffDays, i].sort() })} className={`rounded-md border px-3 py-1.5 text-caption ${on ? 'border-primary bg-accent font-semibold' : ''}`}>{d}</button>; })}</div></div>
      </CardContent></Card>
      <div className="flex justify-end"><Button type="submit" disabled={update.isPending}>{update.isPending && <Spinner className="mr-2" />}Save settings</Button></div>
    </form>
  );
}
function CompanyTab() { const q = useCompany(); return <QueryBoundary query={q} rows={6}>{(c) => <CompanyForm key={c.id} c={c} />}</QueryBoundary>; }

function OrgTab() {
  const depts = useDepartments();
  const desigs = useDesignations();
  const createDept = useCreateDepartment();
  const delDept = useDeleteDepartment();
  const createDesig = useCreateDesignation();
  const delDesig = useDeleteDesignation();
  const [dept, setDept] = React.useState({ name: '', parent: '' });
  const [desig, setDesig] = React.useState('');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Departments</CardTitle></CardHeader><CardContent className="space-y-4">
        <DataTable bare dense rows={depts.data} loading={depts.isLoading} error={depts.error} rowKey={(d) => d.id} emptyTitle="No departments" columns={[{ key: 'n', header: 'Name', cell: (d) => <span className="font-semibold">{d.name}</span> }, { key: 'p', header: 'Parent', cell: (d) => depts.data?.find((x) => x.id === d.parentDepartmentId)?.name ?? '-' }, { key: 'c', header: 'People', cell: (d) => d.employeeCount, align: 'right' }, { key: 'x', header: '', align: 'right', cell: (d) => <Button size="icon" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => delDept.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button> }]} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); createDept.mutate({ name: dept.name, parentDepartmentId: dept.parent || undefined }, { onSuccess: () => setDept({ name: '', parent: '' }) }); }}><Input required placeholder="New department" aria-label="Department name" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} /><NativeSelect aria-label="Parent" className="w-40" value={dept.parent} onChange={(e) => setDept({ ...dept, parent: e.target.value })}><option value="">No parent</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect><Button type="submit" disabled={createDept.isPending}>Add</Button></form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Designations</CardTitle></CardHeader><CardContent className="space-y-4">
        <DataTable bare dense rows={desigs.data} loading={desigs.isLoading} error={desigs.error} rowKey={(d) => d.id} emptyTitle="No designations" columns={[{ key: 'n', header: 'Title', cell: (d) => <span className="font-semibold">{d.name}</span> }, { key: 'c', header: 'People', cell: (d) => d.employeeCount, align: 'right' }, { key: 'x', header: '', align: 'right', cell: (d) => <Button size="icon" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => delDesig.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button> }]} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); createDesig.mutate({ name: desig }, { onSuccess: () => setDesig('') }); }}><Input required placeholder="New designation" aria-label="Designation" value={desig} onChange={(e) => setDesig(e.target.value)} /><Button type="submit" disabled={createDesig.isPending}>Add</Button></form>
      </CardContent></Card>
    </div>
  );
}

function HolidaysTab() {
  const lists = useHolidayLists();
  const create = useCreateHolidayList();
  const del = useDeleteHolidayList();
  const states = useStates();
  const [open, setOpen] = React.useState(false);
  const y = new Date().getFullYear();
  const [f, setF] = React.useState<{ name: string; year: string; state: string; text: string }>({ name: '', year: String(y), state: '', text: '' });
  const parse = (): HolidayItem[] => f.text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [date, ...rest] = l.split(/[,\t]/); return { date: date.trim(), name: rest.join(',').trim(), isOptional: /optional/i.test(rest.join(',')) }; }).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.name);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New holiday list</Button></div>
      <QueryBoundary query={lists} empty={{ when: (d) => d.length === 0, title: 'No holiday lists' }}>{(ls) => (
        <div className="grid gap-4 lg:grid-cols-2">{ls.map((l) => (
          <Card key={l.id}><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>{l.name} {l.state ? <Badge variant="info" className="ml-2">{l.state}</Badge> : <Badge variant="muted" className="ml-2">All states</Badge>}</CardTitle><Button size="icon" variant="ghost" aria-label="Delete list" onClick={() => del.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button></CardHeader>
            <CardContent><ul className="divide-y text-caption">{l.holidays.map((h) => <li key={h.date + h.name} className="flex justify-between py-1.5"><span>{h.name}{h.isOptional && <Badge variant="muted" className="ml-2">Optional</Badge>}</span><span className="text-muted-foreground">{formatDate(h.date)}</span></li>)}</ul></CardContent></Card>
        ))}</div>
      )}</QueryBoundary>
      <Modal open={open} onOpenChange={setOpen} size="lg" title="New holiday list" description="Lists without a state apply to everyone; a state-specific list adds to them for employees in that state.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ name: f.name, year: Number(f.year), state: f.state || null, holidays: parse() }, { onSuccess: () => setOpen(false) }); }}>
          <FormGrid cols={3}><Field label="Name" htmlFor="hn" required><Input id="hn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Karnataka Holidays 2027" /></Field><Field label="Year" htmlFor="hy"><Input id="hy" type="number" required value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></Field><Field label="State (optional)"><NativeSelect value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}><option value="">All states</option>{(states.data ?? INDIAN_STATES).map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field></FormGrid>
          <Field label="Holidays" htmlFor="ht" hint="One per line: YYYY-MM-DD, Name (add “optional” to mark a restricted holiday)"><Textarea id="ht" rows={8} className="font-mono text-fine" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder={`${f.year}-01-26, Republic Day\n${f.year}-08-15, Independence Day`} /></Field>
          <p className="text-fine text-muted-foreground">{parse().length} valid holiday(s) parsed. Movable festival dates change every year: verify them against the official calendar.</p>
          <div className="flex justify-end"><Button type="submit" disabled={create.isPending || parse().length === 0}>Create</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function AnnouncementsTab() {
  const q = useAnnouncements();
  const create = useCreateAnnouncement();
  const del = useDeleteAnnouncement();
  const [f, setF] = React.useState({ title: '', body: '', pinned: false });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-3">{q.data?.map((a) => <Card key={a.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{a.title}{a.pinned && <Badge variant="info" className="ml-2">Pinned</Badge>}</p><p className="mt-1 whitespace-pre-line text-caption text-muted-foreground">{a.body}</p><p className="mt-2 text-fine text-muted-foreground">{formatDate(a.publishAt)}</p></div><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button></div></Card>)}{q.data?.length === 0 && <p className="text-caption text-muted-foreground">No announcements yet.</p>}</div>
      <Card className="h-fit"><CardHeader><CardTitle>Publish announcement</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(f, { onSuccess: () => setF({ title: '', body: '', pinned: false }) }); }}>
          <Field label="Title" htmlFor="at" required><Input id="at" required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label="Message" htmlFor="ab" required><Textarea id="ab" rows={5} required minLength={2} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-caption"><Checkbox checked={f.pinned} onCheckedChange={(c) => setF({ ...f, pinned: c })} />Pin to the top</label><Button type="submit" disabled={create.isPending}>Publish & notify everyone</Button></form>
      </CardContent></Card>
    </div>
  );
}

function PoliciesTab() {
  const q = usePolicies();
  const create = useCreatePolicy();
  const update = useUpdatePolicy();
  const [edit, setEdit] = React.useState<{ id?: string; title: string; category: string; content: string } | null>(null);
  const [ackId, setAckId] = React.useState<string | undefined>();
  const acks = usePolicyAcks(ackId);
  const save = () => { if (!edit) return; (edit.id ? update.mutate({ id: edit.id, data: { title: edit.title, category: edit.category, content: edit.content } }, { onSuccess: () => setEdit(null) }) : create.mutate({ title: edit.title, category: edit.category, content: edit.content }, { onSuccess: () => setEdit(null) })); };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEdit({ title: '', category: 'HR', content: '' })}><Plus className="mr-1 h-4 w-4" />New policy</Button></div>
      <DataTable rows={q.data} loading={q.isLoading} error={q.error} rowKey={(p) => p.id} emptyTitle="No policies" columns={[
        { key: 't', header: 'Policy', cell: (p) => <div><p className="font-semibold">{p.title}</p><p className="text-fine text-muted-foreground">{p.category} · v{p.version}</p></div> }, { key: 'a', header: 'Acknowledged', cell: (p) => p.acknowledgedCount, align: 'right' },
        { key: 's', header: 'Active', cell: (p) => <Checkbox checked={p.isActive} onCheckedChange={(c) => update.mutate({ id: p.id, data: { isActive: c } })} aria-label={`${p.title} active`} /> },
        { key: 'x', header: '', align: 'right', cell: (p) => <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setAckId(p.id)}>Who signed</Button><Button size="sm" variant="ghost" onClick={() => setEdit({ id: p.id, title: p.title, category: p.category, content: p.content })}>Edit</Button></div> },
      ]} />
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="lg" title={edit?.id ? 'Edit policy' : 'New policy'} description="Changing the text publishes a new version that everyone must acknowledge again."
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.title || !edit?.content || create.isPending || update.isPending} onClick={save}>Publish</Button></>}>
        {edit && <div className="space-y-4"><FormGrid><Field label="Title" htmlFor="pt" required><Input id="pt" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field><Field label="Category" htmlFor="pc"><Input id="pc" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field></FormGrid><Field label="Content" htmlFor="pb" required><Textarea id="pb" rows={10} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></Field></div>}
      </Modal>
      <Modal open={!!ackId} onOpenChange={(o) => !o && setAckId(undefined)} title="Acknowledgements (current version)">
        <QueryBoundary query={acks}>{(rows) => <><p className="mb-2 text-caption text-muted-foreground">{rows.filter((r) => r.acknowledgedAt).length} of {rows.length} acknowledged</p><ul className="max-h-80 divide-y overflow-y-auto text-caption">{rows.map((r) => <li key={r.employeeId} className="flex justify-between py-1.5"><span>{r.name} <span className="text-fine text-muted-foreground">{r.employeeCode}</span></span>{r.acknowledgedAt ? <span className="text-success">{formatDate(r.acknowledgedAt)}</span> : <span className="text-warning">Pending</span>}</li>)}</ul></>}</QueryBoundary>
      </Modal>
    </div>
  );
}
