'use client';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { Field, FormGrid } from '@/components/common/field';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { AppraisalModal } from '@/components/performance/appraisal-modal';
import { RatingDisplay, RatingInput } from '@/components/performance/rating';
import { useCreateGoal, useGoals, useMyAppraisals, useUpdateGoal } from '@/hooks/performance/use-performance';
import { formatDate, todayISO } from '@/lib/format';
import type { Goal } from '@/types/performance';

export default function MyPerformancePage() {
  const goals = useGoals();
  const appraisals = useMyAppraisals();
  const [goalOpen, setGoalOpen] = React.useState(false);
  const [progress, setProgress] = React.useState<Goal | null>(null);
  const [openId, setOpenId] = React.useState<string | undefined>();
  const total = goals.data?.filter((g) => g.status !== 'REJECTED').reduce((s, g) => s + g.weightage, 0) ?? 0;
  return (
    <>
      <PageHeader title="Performance" description="Goals, self-assessment and appraisals." actions={<Button onClick={() => setGoalOpen(true)}><Plus className="mr-2 h-4 w-4" />Add goal</Button>} />
      <Tabs defaultValue="goals">
        <TabsList><TabsTrigger value="goals">My goals</TabsTrigger><TabsTrigger value="appraisals">Appraisals</TabsTrigger></TabsList>
        <TabsContent value="goals" className="mt-4 space-y-3">
          <p className="text-caption text-muted-foreground">Total weightage of active goals: <b className={total > 100 ? 'text-destructive' : 'text-foreground'}>{total}%</b> (must not exceed 100%)</p>
          <DataTable rows={goals.data} loading={goals.isLoading} error={goals.error} rowKey={(g) => g.id} emptyTitle="No goals yet" emptyDescription="Add goals for the cycle; your manager approves them." columns={[
            { key: 't', header: 'Goal', cell: (g) => <div><p className="font-semibold">{g.title}</p>{g.description && <p className="line-clamp-1 text-fine text-muted-foreground">{g.description}</p>}</div> },
            { key: 'w', header: 'Weight', cell: (g) => `${g.weightage}%`, align: 'right' },
            { key: 'p', header: 'Period', cell: (g) => `${formatDate(g.startDate, false)} - ${formatDate(g.endDate, false)}`, hideOnMobile: true },
            { key: 'a', header: 'Achieved', cell: (g) => g.achievedValue ?? '-', hideOnMobile: true },
            { key: 'r', header: 'Self / Mgr', cell: (g) => <span className="flex gap-2"><RatingDisplay value={g.selfRating} />/<RatingDisplay value={g.managerRating} /></span> },
            { key: 's', header: 'Status', cell: (g) => <StatusBadge status={g.status} /> },
            { key: 'x', header: '', align: 'right', cell: (g) => <Button size="sm" variant="ghost" onClick={() => setProgress(g)}>Update</Button> },
          ]} />
        </TabsContent>
        <TabsContent value="appraisals" className="mt-4">
          <DataTable rows={appraisals.data} loading={appraisals.isLoading} error={appraisals.error} rowKey={(a) => a.id} onRowClick={(a) => setOpenId(a.id)} emptyTitle="No appraisals" emptyDescription="You'll see appraisal cycles here when HR launches them." columns={[
            { key: 'c', header: 'Cycle', cell: (a) => <span className="font-semibold">{a.appraisalCycle.name}</span> },
            { key: 's', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
            { key: 'sr', header: 'Self', cell: (a) => <RatingDisplay value={a.selfRating} /> },
            { key: 'fr', header: 'Final', cell: (a) => <RatingDisplay value={a.finalRating} /> },
            { key: 'x', header: '', align: 'right', cell: (a) => (a.status === 'SELF_REVIEW' ? <Button size="sm">Start self-review</Button> : <Button size="sm" variant="ghost">View</Button>) },
          ]} />
        </TabsContent>
      </Tabs>
      <GoalModal open={goalOpen} onOpenChange={setGoalOpen} />
      <ProgressModal goal={progress} onClose={() => setProgress(null)} />
      <AppraisalModal id={openId} onClose={() => setOpenId(undefined)} />
    </>
  );
}

function GoalModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateGoal();
  const y = new Date().getFullYear();
  const [f, setF] = React.useState({ title: '', description: '', weightage: '20', targetValue: '', startDate: todayISO(), endDate: `${y}-12-31` });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New goal">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ title: f.title, description: f.description || undefined, weightage: Number(f.weightage), targetValue: f.targetValue || undefined, startDate: f.startDate, endDate: f.endDate }, { onSuccess: () => { setF({ ...f, title: '', description: '' }); onOpenChange(false); } }); }}>
        <Field label="Goal" htmlFor="gt" required><Input id="gt" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Description" htmlFor="gd"><Textarea id="gd" value={f.description} onChange={set('description')} /></Field>
        <FormGrid><Field label="Weightage (%)" htmlFor="gw" required><Input id="gw" type="number" min="1" max="100" required value={f.weightage} onChange={set('weightage')} /></Field><Field label="Target" htmlFor="gv"><Input id="gv" value={f.targetValue} onChange={set('targetValue')} placeholder="e.g. 30% faster" /></Field>
          <Field label="Start" htmlFor="gs" required><Input id="gs" type="date" required value={f.startDate} onChange={set('startDate')} /></Field><Field label="End" htmlFor="ge" required><Input id="ge" type="date" required min={f.startDate} value={f.endDate} onChange={set('endDate')} /></Field></FormGrid>
        <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>Add goal</Button></div>
      </form>
    </Modal>
  );
}

function ProgressModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const update = useUpdateGoal();
  const [achieved, setAchieved] = React.useState('');
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  React.useEffect(() => { if (goal) { setAchieved(goal.achievedValue ?? ''); setRating(goal.selfRating ?? 0); setComment(goal.selfComment ?? ''); } }, [goal]);
  return (
    <Modal open={!!goal} onOpenChange={(o) => !o && onClose()} title={goal?.title ?? ''} description="Record progress and rate yourself.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); goal && update.mutate({ id: goal.id, data: { achievedValue: achieved, selfRating: rating || null, selfComment: comment } }, { onSuccess: onClose }); }}>
        <Field label="Achieved so far" htmlFor="ga"><Input id="ga" value={achieved} onChange={(e) => setAchieved(e.target.value)} /></Field>
        <Field label="Self rating"><RatingInput label="Self rating" value={rating} onChange={setRating} /></Field>
        <Field label="Comment" htmlFor="gc"><Textarea id="gc" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        <div className="flex justify-end"><Button type="submit" disabled={update.isPending}>Save</Button></div>
      </form>
    </Modal>
  );
}
