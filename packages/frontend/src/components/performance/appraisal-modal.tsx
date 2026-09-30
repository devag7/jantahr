'use client';
import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DetailList } from '@/components/common/detail-list';
import { Field } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { QueryBoundary, Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { RatingDisplay, RatingInput } from '@/components/performance/rating';
import { useAuth } from '@/hooks/auth/use-auth';
import { useAppraisal, useApplyRevision, useFinalize, useManagerReview, useSelfReview } from '@/hooks/performance/use-performance';
import { formatDate, todayISO } from '@/lib/format';
import { ADMIN, PAYROLL } from '@/lib/permissions';
import type { AppraisalDetail } from '@/types/performance';

/** One dialog for the whole appraisal workflow: self → manager → HR → (optional) salary revision. */
export function AppraisalModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const q = useAppraisal(id);
  return (
    <Modal open={!!id} onOpenChange={(o) => !o && onClose()} size="lg" title="Appraisal" description={q.data ? `${q.data.employee.firstName} ${q.data.employee.lastName} · ${q.data.appraisalCycle.name}` : undefined}>
      <QueryBoundary query={q}>{(a) => <Body a={a} onDone={onClose} />}</QueryBoundary>
    </Modal>
  );
}

function Body({ a, onDone }: { a: AppraisalDetail; onDone: () => void }) {
  const { user, hasRole } = useAuth();
  const self = useSelfReview();
  const mgr = useManagerReview();
  const fin = useFinalize();
  const rev = useApplyRevision();
  const isSelf = a.employeeId === user?.employee?.id;
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [promo, setPromo] = React.useState(a.promotionRecommended);
  const [pct, setPct] = React.useState('');
  const [eff, setEff] = React.useState(todayISO());

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><StatusBadge status={a.status} />{a.goalScore !== null && <span className="text-caption text-muted-foreground">Goal score <b className="text-foreground">{a.goalScore}/5</b></span>}</div>
      <DetailList items={[{ label: 'Self rating', value: <RatingDisplay value={a.selfRating} /> }, { label: 'Manager rating', value: <RatingDisplay value={a.managerRating} /> }, { label: 'Final rating', value: <RatingDisplay value={a.finalRating} /> }, { label: 'Promotion recommended', value: a.promotionRecommended ? 'Yes' : 'No' }]} />
      {a.selfComment && <p className="rounded-md bg-muted/50 p-3 text-caption"><b>Self:</b> {a.selfComment}</p>}
      {a.managerComment && <p className="rounded-md bg-muted/50 p-3 text-caption"><b>Manager:</b> {a.managerComment}</p>}
      {a.hrComment && <p className="rounded-md bg-muted/50 p-3 text-caption"><b>HR:</b> {a.hrComment}</p>}
      {a.goals.length > 0 && (
        <div><p className="mb-2 text-fine font-semibold uppercase tracking-wide text-muted-foreground">Goals in this cycle</p>
          <ul className="divide-y rounded-md border text-caption">{a.goals.map((g) => <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2"><span>{g.title} <span className="text-fine text-muted-foreground">({g.weightage}%)</span></span><span className="flex gap-3 text-fine text-muted-foreground">Self <RatingDisplay value={g.selfRating} /> Mgr <RatingDisplay value={g.managerRating} /></span></li>)}</ul></div>
      )}

      {a.status === 'SELF_REVIEW' && isSelf && (
        <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault(); self.mutate({ id: a.id, selfRating: rating, selfComment: comment }, { onSuccess: onDone }); }}>
          <p className="font-semibold">Your self-review</p><RatingInput label="Self rating" value={rating} onChange={setRating} />
          <Field label="What did you achieve this cycle?" required><Textarea required minLength={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <Button type="submit" disabled={!rating || self.isPending}>{self.isPending && <Spinner className="mr-2" />}Submit self-review</Button>
        </form>
      )}
      {a.status === 'MANAGER_REVIEW' && !isSelf && (
        <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault(); mgr.mutate({ id: a.id, managerRating: rating, managerComment: comment, promotionRecommended: promo }, { onSuccess: onDone }); }}>
          <p className="font-semibold">Manager assessment</p><RatingInput label="Manager rating" value={rating} onChange={setRating} />
          <Field label="Assessment" required><Textarea required minLength={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-caption"><Checkbox checked={promo} onCheckedChange={setPromo} />Recommend for promotion</label>
          <Button type="submit" disabled={!rating || mgr.isPending}>{mgr.isPending && <Spinner className="mr-2" />}Submit assessment</Button>
        </form>
      )}
      {a.status === 'HR_REVIEW' && hasRole(ADMIN) && (
        <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault(); fin.mutate({ id: a.id, finalRating: rating, hrComment: comment || undefined, promotionRecommended: promo, salaryRevisionPercent: pct ? Number(pct) : undefined }, { onSuccess: onDone }); }}>
          <p className="font-semibold">HR calibration</p><RatingInput label="Final rating" value={rating} onChange={setRating} />
          <Field label="HR comment"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <Field label="Salary revision (%)" hint="Optional. You can apply it to CTC after finalising."><Input type="number" min="0" max="100" step="0.5" className="w-32" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-caption"><Checkbox checked={promo} onCheckedChange={setPromo} />Promotion approved</label>
          <Button type="submit" disabled={!rating || fin.isPending}>{fin.isPending && <Spinner className="mr-2" />}Finalise appraisal</Button>
        </form>
      )}
      {a.status === 'COMPLETED' && Number(a.salaryRevisionPercent) > 0 && hasRole(PAYROLL) && (
        <div className="space-y-3 border-t pt-4"><p className="font-semibold">Salary revision: +{a.salaryRevisionPercent}%</p>
          <div className="flex flex-wrap items-end gap-3"><Field label="Effective from"><Input type="date" value={eff} onChange={(e) => setEff(e.target.value)} className="w-44" /></Field>
            <Button disabled={rev.isPending} onClick={() => rev.mutate({ id: a.id, effectiveFrom: eff })}>{rev.isPending && <Spinner className="mr-2" />}Apply to CTC</Button></div>
          <p className="text-fine text-muted-foreground">Creates a new salary assignment from {formatDate(eff)}. Payroll for approved months is not changed.</p></div>
      )}
    </div>
  );
}
