'use client';
import * as React from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/auth/use-auth';
import { useSetupStatus } from '@/hooks/org/use-org';
import { ADMIN } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/stores/onboarding/onboarding-store';
import type { SetupStepKey } from '@/types/org';

const STEPS: Record<SetupStepKey, { title: string; why: string; href: string; cta: string }> = {
  company: { title: 'Add your company details', why: 'PAN, TAN and the registered address are printed on payslips, Form 16 and statutory returns.', href: '/hr/settings?tab=company', cta: 'Add details' },
  org: { title: 'Create departments and designations', why: 'They drive reporting lines, approvals and every headcount report.', href: '/hr/settings?tab=org', cta: 'Set up' },
  holidays: { title: "Set this year's holidays", why: 'Leave and attendance skip the days you list here.', href: '/hr/settings?tab=holidays', cta: 'Add holidays' },
  employees: { title: 'Add your employees', why: 'Add people one at a time or import a spreadsheet. Each person gets their own sign-in.', href: '/hr/employees', cta: 'Add employees' },
  salary: { title: 'Assign salaries', why: 'Choose a salary structure and CTC for each person. PF, ESI, professional tax and TDS follow from it.', href: '/hr/payroll/setup', cta: 'Assign salaries' },
  payroll: { title: 'Run your first payroll', why: 'Generate, review and approve. Payslips, bank advice and filing files come from the same run.', href: '/hr/payroll', cta: 'Open payroll' },
};

/** Setup checklist for a new company. Each step ticks itself off from real data; admins can hide it and bring it back from the account menu. */
export function SetupGuide() {
  const { user, hasRole } = useAuth();
  const admin = hasRole(ADMIN);
  const q = useSetupStatus(admin);
  const hidden = useOnboardingStore((s) => s.guideHidden);
  const loadGuide = useOnboardingStore((s) => s.loadGuide);
  const setHidden = useOnboardingStore((s) => s.setGuideHidden);
  const companyId = user?.company.id;
  React.useEffect(() => { if (companyId) loadGuide(companyId); }, [companyId, loadGuide]);

  if (!admin || !companyId || !q.data || q.data.complete || hidden) return null;
  const { steps, done, total } = q.data;
  const next = steps.find((s) => !s.done)?.key;
  return (
    <Card data-tour="setup-guide" aria-labelledby="setup-guide-title">
      <CardContent className="p-0">
        <div className="flex items-start gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id="setup-guide-title" className="text-body-strong">Get {user.company.name} ready for payroll</h2>
            <p className="mt-0.5 text-caption text-muted-foreground">{done} of {total} steps done. Each one ticks itself off as you go, in any order.</p>
            <Progress value={(done / total) * 100} className="mt-3 max-w-md" tone={done === total ? 'success' : 'primary'} />
          </div>
          <button onClick={() => setHidden(companyId, true)} aria-label="Hide setup guide" title="Hide. Bring it back from the account menu."
            className="-mr-2 -mt-1 rounded-sm p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <ol className="divide-y border-t">
          {steps.map((s, n) => {
            const step = STEPS[s.key];
            const isNext = s.key === next;
            return (
              <li key={s.key} className={cn('flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center', isNext && 'bg-accent/40')}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fine font-semibold',
                    s.done ? 'bg-success text-white' : isNext ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground')}>
                    {s.done ? <Check className="h-3.5 w-3.5" /> : n + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('text-caption-strong', s.done && 'text-muted-foreground line-through decoration-muted-foreground/50')}>
                      {step.title}<span className="sr-only">{s.done ? ' (done)' : isNext ? ' (next)' : ''}</span>
                    </p>
                    {!s.done && <p className="mt-0.5 text-caption text-muted-foreground">{step.why}</p>}
                  </div>
                </div>
                {!s.done && (
                  <Button asChild size="sm" variant={isNext ? 'default' : 'outline'} className="ml-9 shrink-0 self-start sm:ml-0 sm:self-center">
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
