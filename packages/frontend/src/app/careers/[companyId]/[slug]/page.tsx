'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { BrandMark } from '@/components/auth/brand-mark';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormGrid } from '@/components/common/field';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { FormError } from '@/components/auth/auth-form';
import { useApplyPublic, usePublicJob } from '@/hooks/recruitment/use-recruitment';
import { errorMessage } from '@/lib/api/client';

export default function JobPage() {
  const { companyId, slug } = useParams<{ companyId: string; slug: string }>();
  const q = usePublicJob(slug);
  const apply = useApplyPublic();
  const [f, setF] = React.useState({ name: '', email: '', phone: '', currentCtc: '', expectedCtc: '', noticeDays: '', coverNote: '' });
  const [resume, setResume] = React.useState<File | null>(null);
  const [accepted, setAccepted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => { if (v) form.append(k, v); });
    if (resume) form.append('resume', resume);
    form.append('acceptedPrivacy', String(accepted));
    apply.mutate({ slug, form }, { onError: (err) => setError(errorMessage(err)) });
  };

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between"><BrandMark /><Link href={`/careers/${companyId}`} className="text-caption text-primary hover:underline">← All positions</Link></div>
      <QueryBoundary query={q}>
        {(j) => (
          <>
            <h1 className="text-display-sm font-semibold sm:text-title">{j.title}</h1>
            <p className="mt-2 text-muted-foreground">{[j.location, j.employmentType, j.experience].filter(Boolean).join(' · ')}</p>
            <div className="mt-6 whitespace-pre-line rounded-md border bg-card p-5 text-caption leading-relaxed">{j.description}</div>
            <h2 className="mb-4 mt-10 text-tagline font-semibold">Apply for this role</h2>
            {apply.isSuccess ? (
              <div className="flex items-start gap-3 rounded-md border bg-muted p-5"><CheckCircle2 className="mt-0.5 h-5 w-5 text-success" /><div><p className="font-semibold">Application received</p><p className="text-caption text-muted-foreground">{apply.data.message}</p></div></div>
            ) : (
              <form onSubmit={submit} className="space-y-4 rounded-md border bg-card p-5">
                <FormError message={error} />
                <FormGrid><Field label="Full name" htmlFor="n" required><Input id="n" required value={f.name} onChange={set('name')} /></Field><Field label="Email" htmlFor="e" required><Input id="e" type="email" required value={f.email} onChange={set('email')} /></Field><Field label="Phone" htmlFor="p"><Input id="p" value={f.phone} onChange={set('phone')} /></Field><Field label="Notice period (days)" htmlFor="np"><Input id="np" type="number" min="0" value={f.noticeDays} onChange={set('noticeDays')} /></Field>
                  <Field label="Current CTC (₹/yr)" htmlFor="c"><Input id="c" type="number" min="0" value={f.currentCtc} onChange={set('currentCtc')} /></Field><Field label="Expected CTC (₹/yr)" htmlFor="x"><Input id="x" type="number" min="0" value={f.expectedCtc} onChange={set('expectedCtc')} /></Field></FormGrid>
                <Field label="Résumé (PDF/DOC, up to 10 MB)" htmlFor="r"><Input id="r" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResume(e.target.files?.[0] ?? null)} /></Field>
                <Field label="Cover note" htmlFor="cn"><Textarea id="cn" rows={4} value={f.coverNote} onChange={set('coverNote')} /></Field>
                <label className="flex items-start gap-2 text-caption text-muted-foreground"><Checkbox className="mt-0.5" checked={accepted} onCheckedChange={setAccepted} aria-label="Accept privacy notice" /><span>I agree that my details will be used only to assess my application for this and similar roles. They are kept for up to 12 months and then deleted, and I can ask for them to be erased at any time by writing to the company&apos;s HR team.</span></label>
                <Button type="submit" disabled={apply.isPending || !accepted}>{apply.isPending && <Spinner className="mr-2" />}Submit application</Button>
              </form>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
