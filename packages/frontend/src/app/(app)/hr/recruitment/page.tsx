'use client';
import * as React from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { useAuth } from '@/hooks/auth/use-auth';
import { useApplicants, useCreateJob, useCreateOffer, useFunnel, useHire, useJobs, useMoveStage, useRespondOffer, useScheduleInterview, useUpdateJob } from '@/hooks/recruitment/use-recruitment';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import type { Applicant, ApplicantStage, JobStatus } from '@/types/recruitment';

const STAGES: ApplicantStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export default function RecruitmentPage() {
  const { user, hasRole } = useAuth();
  const admin = hasRole(ADMIN);
  const jobs = useJobs();
  const funnel = useFunnel();
  const [jobId, setJobId] = React.useState('');
  const applicants = useApplicants(jobId || undefined);
  const move = useMoveStage();
  const [newJob, setNewJob] = React.useState(false);
  const [openApplicant, setOpenApplicant] = React.useState<string | undefined>();
  const update = useUpdateJob();
  const careersUrl = typeof window !== 'undefined' && user ? `${window.location.origin}/careers/${user.company.id}` : '';
  const selected = applicants.data?.find((a) => a.id === openApplicant);
  return (
    <>
      <PageHeader title="Recruitment" description="Job openings, applicant tracking, interviews and offers." actions={<>{careersUrl && <Button variant="outline" asChild><a href={careersUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Public careers page</a></Button>}{admin && <Button onClick={() => setNewJob(true)}><Plus className="mr-2 h-4 w-4" />New job</Button>}</>} />
      <Tabs defaultValue="pipeline">
        <TabsList><TabsTrigger value="pipeline">Pipeline</TabsTrigger><TabsTrigger value="jobs">Job openings</TabsTrigger></TabsList>
        <TabsContent value="pipeline" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3"><NativeSelect aria-label="Job" className="w-72" value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">All openings</option>{jobs.data?.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</NativeSelect>
            {funnel.data && <p className="text-caption text-muted-foreground">Funnel: {STAGES.map((s) => `${s.charAt(0) + s.slice(1).toLowerCase()} ${funnel.data[s]}`).join(' · ')}</p>}</div>
          <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-5" style={{ gridAutoColumns: 'minmax(15rem, 1fr)' }}>
            {STAGES.filter((s) => s !== 'REJECTED').map((stage) => {
              const items = applicants.data?.filter((a) => a.stage === stage) ?? [];
              return (
                <div key={stage} className="min-w-60 rounded-md bg-muted/40 p-2"><div className="mb-2 flex items-center justify-between px-1"><StatusBadge status={stage} /><span className="text-fine text-muted-foreground">{items.length}</span></div>
                  <div className="space-y-2">{items.map((a) => (
                    <Card key={a.id} className="cursor-pointer p-3 text-caption"><button className="w-full text-left" onClick={() => setOpenApplicant(a.id)}><p className="font-semibold">{a.name}</p><p className="truncate text-fine text-muted-foreground">{a.jobOpening.title}</p>{a.expectedCtc && <p className="mt-1 text-fine">Expects {formatINR(a.expectedCtc)}</p>}{a.interviews.some((i) => i.status === 'SCHEDULED') && <Badge variant="info" className="mt-1">Interview scheduled</Badge>}</button></Card>
                  ))}{items.length === 0 && <p className="px-1 py-4 text-center text-fine text-muted-foreground">Empty</p>}</div></div>
              );
            })}
          </div>
          {(applicants.data?.filter((a) => a.stage === 'REJECTED').length ?? 0) > 0 && <p className="text-fine text-muted-foreground">{applicants.data?.filter((a) => a.stage === 'REJECTED').length} rejected candidate(s) not shown.</p>}
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <DataTable rows={jobs.data} loading={jobs.isLoading} error={jobs.error} rowKey={(j) => j.id} emptyTitle="No job openings" columns={[
            { key: 't', header: 'Job', cell: (j) => <div><p className="font-semibold">{j.title}</p><p className="text-fine text-muted-foreground">{j.location ?? '-'} · {j.employmentType} · {j.vacancies} vacancy(ies)</p></div> },
            { key: 'a', header: 'Applicants', cell: (j) => j._count.applicants, align: 'right' }, { key: 'p', header: 'Published', cell: (j) => (j.publishedAt ? formatDate(j.publishedAt) : '-'), hideOnMobile: true }, { key: 's', header: 'Status', cell: (j) => <StatusBadge status={j.status} /> },
            { key: 'x', header: '', cell: (j) => admin && <NativeSelect aria-label="Status" className="h-8 w-32 py-0 text-fine" value={j.status} onChange={(e) => update.mutate({ id: j.id, data: { status: e.target.value as JobStatus } })}>{(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED'] as const).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</NativeSelect> },
          ]} />
        </TabsContent>
      </Tabs>
      <NewJobModal open={newJob} onOpenChange={setNewJob} />
      <ApplicantModal a={selected} onClose={() => setOpenApplicant(undefined)} canEdit={admin} onMove={(stage) => selected && move.mutate({ id: selected.id, stage })} />
    </>
  );
}

function NewJobModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateJob();
  const [f, setF] = React.useState({ title: '', location: '', experience: '', vacancies: '1', description: '', status: 'OPEN' as JobStatus });
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title="New job opening">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ title: f.title, location: f.location || undefined, experience: f.experience || undefined, vacancies: Number(f.vacancies), description: f.description, status: f.status }, { onSuccess: () => { onOpenChange(false); setF({ ...f, title: '', description: '' }); } }); }}>
        <Field label="Title" htmlFor="jt" required><Input id="jt" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <FormGrid cols={3}><Field label="Location" htmlFor="jl"><Input id="jl" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field><Field label="Experience" htmlFor="je"><Input id="je" value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} placeholder="3-5 years" /></Field><Field label="Vacancies" htmlFor="jv"><Input id="jv" type="number" min="1" value={f.vacancies} onChange={(e) => setF({ ...f, vacancies: e.target.value })} /></Field></FormGrid>
        <Field label="Description" htmlFor="jd" required><Textarea id="jd" rows={6} required minLength={10} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Publish"><NativeSelect value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as JobStatus })}><option value="OPEN">Publish on careers page now</option><option value="DRAFT">Save as draft</option></NativeSelect></Field>
        <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Save job</Button></div>
      </form>
    </Modal>
  );
}

function ApplicantModal({ a, onClose, canEdit, onMove }: { a?: Applicant; onClose: () => void; canEdit: boolean; onMove: (s: ApplicantStage) => void }) {
  const schedule = useScheduleInterview();
  const offer = useCreateOffer();
  const respond = useRespondOffer();
  const hire = useHire();
  const [iv, setIv] = React.useState({ round: 'Technical Round 1', scheduledAt: '', mode: 'Video' });
  const [of, setOf] = React.useState({ designation: '', ctc: '', joiningDate: '' });
  const [gender, setGender] = React.useState('MALE');
  const acceptedOffer = a?.offers.find((o) => o.status === 'ACCEPTED');
  return (
    <Modal open={!!a} onOpenChange={(o) => !o && onClose()} size="lg" title={a?.name ?? ''} description={a ? `${a.email}${a.phone ? ` · ${a.phone}` : ''} · applied ${formatDate(a.createdAt)} for ${a.jobOpening.title}` : undefined}>
      {a && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3"><StatusBadge status={a.stage} />{canEdit && a.stage !== 'HIRED' && <NativeSelect aria-label="Move to stage" className="w-44" value={a.stage} onChange={(e) => onMove(e.target.value as ApplicantStage)}>{STAGES.filter((s) => s !== 'HIRED').map((s) => <option key={s} value={s}>Move to {s.toLowerCase()}</option>)}</NativeSelect>}
            <span className="text-caption text-muted-foreground">Current {a.currentCtc ? formatINR(a.currentCtc) : '-'} · Expected {a.expectedCtc ? formatINR(a.expectedCtc) : '-'} · Notice {a.noticeDays ?? '-'} days</span></div>
          {a.interviews.length > 0 && <div><p className="mb-2 text-caption font-semibold">Interviews</p><ul className="divide-y rounded-md border text-caption">{a.interviews.map((i) => <li key={i.id} className="flex items-center justify-between px-3 py-2"><span>{i.round} · {formatDateTime(i.scheduledAt)} · {i.mode}</span><StatusBadge status={i.status} /></li>)}</ul></div>}
          {canEdit && a.stage !== 'HIRED' && a.stage !== 'REJECTED' && (
            <form className="grid items-end gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); schedule.mutate({ applicantId: a.id, round: iv.round, scheduledAt: new Date(iv.scheduledAt).toISOString(), mode: iv.mode }); }}>
              <Field label="Round" className="sm:col-span-1"><Input value={iv.round} onChange={(e) => setIv({ ...iv, round: e.target.value })} /></Field><Field label="When" className="sm:col-span-2"><Input type="datetime-local" required value={iv.scheduledAt} onChange={(e) => setIv({ ...iv, scheduledAt: e.target.value })} /></Field><Button type="submit" variant="outline" disabled={schedule.isPending}>Schedule interview</Button>
            </form>
          )}
          {a.offers.length > 0 && <div><p className="mb-2 text-caption font-semibold">Offers</p><ul className="divide-y rounded-md border text-caption">{a.offers.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span>{o.designation} · {formatINR(o.ctc)} · joining {formatDate(o.joiningDate)}</span><span className="flex items-center gap-2"><StatusBadge status={o.status} />{canEdit && o.status === 'SENT' && <><Button size="sm" variant="outline" onClick={() => respond.mutate({ id: o.id, action: 'decline' })}>Declined</Button><Button size="sm" onClick={() => respond.mutate({ id: o.id, action: 'accept' })}>Accepted</Button></>}</span></li>)}</ul></div>}
          {canEdit && (a.stage === 'INTERVIEW' || a.stage === 'OFFER') && !acceptedOffer && (
            <form className="grid items-end gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); offer.mutate({ applicantId: a.id, designation: of.designation, ctc: Number(of.ctc), joiningDate: of.joiningDate }); }}>
              <Field label="Designation"><Input required value={of.designation} onChange={(e) => setOf({ ...of, designation: e.target.value })} /></Field><Field label="Annual CTC (₹)"><Input type="number" min="1" required value={of.ctc} onChange={(e) => setOf({ ...of, ctc: e.target.value })} /></Field><Field label="Joining date"><Input type="date" required value={of.joiningDate} onChange={(e) => setOf({ ...of, joiningDate: e.target.value })} /></Field><Button type="submit" variant="outline" disabled={offer.isPending}>Send offer</Button>
            </form>
          )}
          {canEdit && acceptedOffer && a.stage !== 'HIRED' && (
            <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted p-3"><Field label="Gender (for records)"><NativeSelect value={gender} onChange={(e) => setGender(e.target.value)}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></NativeSelect></Field><Button disabled={hire.isPending} onClick={() => hire.mutate({ offerId: acceptedOffer.id, gender }, { onSuccess: onClose })}>Convert to employee</Button><p className="text-fine text-muted-foreground">Creates the employee, login, leave allocation and onboarding checklist.</p></div>
          )}
        </div>
      )}
    </Modal>
  );
}
