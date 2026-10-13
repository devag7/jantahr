'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/auth/use-auth';
import { tourSeen, useOnboardingStore } from '@/stores/onboarding/onboarding-store';

/** One card of the tour. Without `target` (or when the target is not on screen) the card is centred. */
interface TourStep { key: string; target?: string; title: string; body: string }

const SECTION_COPY: Record<string, { title: string; body: string }> = {
  'nav-home': { title: 'Home', body: 'Your overview: today’s attendance, what is waiting for you and the next statutory deadlines.' },
  'nav-me': { title: 'My work', body: 'Everything about you as an employee: attendance, leave, payslips, tax declarations, expenses and your profile.' },
  'nav-company': { title: 'Company', body: 'The employee directory and the org chart, visible to everyone.' },
  'nav-team': { title: 'Team', body: 'Approve leave, attendance corrections and expense claims from the people who report to you.' },
  'nav-people': { title: 'People', body: 'Employee records, attendance, leave, onboarding and exits, appraisals and hiring.' },
  'nav-payroll': { title: 'Payroll', body: 'Run payroll, set salaries and download PF, ESI, professional tax and TDS files. The compliance calendar lists every due date.' },
  'nav-insights': { title: 'Insights', body: 'Reports you can filter and export, and analytics on headcount, attrition and cost.' },
  'nav-admin': { title: 'Admin', body: 'Company settings, holidays, announcements, billing and data protection requests.' },
};

const STEPS: TourStep[] = [
  { key: 'welcome', title: 'Welcome to JantaHR', body: 'A one-minute tour of where things are. Skip it any time; you can replay it from the account menu.' },
  { key: 'menu', target: 'nav-menu', title: 'Menu', body: 'Every area of JantaHR is in this menu: your own work, your team, people, payroll and settings.' },
  ...Object.entries(SECTION_COPY).map(([target, copy]) => ({ key: target, target, ...copy })),
  { key: 'subnav', target: 'subnav', title: 'Pages in this area', body: 'Each area has its own pages. This bar changes as you move between areas.' },
  { key: 'setup', target: 'setup-guide', title: 'Setup guide', body: 'Six steps to your first payroll. Each one ticks itself off, and you can do them in any order.' },
  { key: 'search', target: 'search', title: 'Search', body: 'Find any employee by name, code or email. Press ⌘K or Ctrl K from anywhere.' },
  { key: 'notifications', target: 'notifications', title: 'Notifications', body: 'Approvals waiting for you, and updates on your own requests.' },
  { key: 'help', target: 'assistant', title: 'Help', body: 'Ask how something works, for example “how do I run payroll?”, and get the steps.' },
  { key: 'account', target: 'account', title: 'Your account', body: 'Your profile, password, light or dark mode, and this tour whenever you want it again.' },
];

const PAD = 6;
const GAP = 12;
const find = (target: string) => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  return el && el.getClientRects().length > 0 ? el : null;
};

/**
 * Coach-mark tour: dims the page, spotlights one control at a time and explains it. Starts once for each new user
 * on the dashboard; Skip, Back and Next are always available, as are Esc and the arrow keys.
 */
export function ProductTour() {
  const pathname = usePathname();
  const { user } = useAuth();
  const open = useOnboardingStore((s) => s.tourOpen);
  const startTour = useOnboardingStore((s) => s.startTour);
  const endTour = useOnboardingStore((s) => s.endTour);
  const [steps, setSteps] = React.useState<TourStep[]>([]);
  const [index, setIndex] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = React.useState(0);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const userId = user?.id;

  // first visit: start on the dashboard once the page has settled
  React.useEffect(() => {
    if (!userId || user?.mustChangePassword || pathname !== '/dashboard' || tourSeen(userId)) return;
    const t = window.setTimeout(startTour, 900);
    return () => window.clearTimeout(t);
  }, [userId, user?.mustChangePassword, pathname, startTour]);

  // only explain what this person can actually see (role, screen size)
  React.useEffect(() => {
    if (!open) return;
    setSteps(STEPS.filter((s) => !s.target || find(s.target)));
    setIndex(0);
  }, [open]);

  const step = open ? steps[index] : undefined;
  const close = React.useCallback(() => { if (userId) endTour(userId); }, [userId, endTour]);
  const go = React.useCallback((delta: number) => {
    if (index + delta >= steps.length) close();
    else setIndex(Math.max(0, index + delta));
  }, [index, steps.length, close]);

  React.useLayoutEffect(() => {
    if (!step) return;
    const el = step.target ? find(step.target) : null;
    if (!el) { setRect(null); return; }
    const measure = () => setRect(el.getBoundingClientRect());
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [step]);

  React.useLayoutEffect(() => { if (step && cardRef.current) setCardHeight(cardRef.current.offsetHeight); }, [step, rect]);
  React.useEffect(() => { if (step) cardRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus(); }, [step]);

  React.useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab') {
        // keep focus inside the card while the rest of the page is covered
        const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, close, go]);

  if (!step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - 24);
  let style: React.CSSProperties = { width, left: (vw - width) / 2, top: Math.max(12, (vh - cardHeight) / 2) };
  if (rect) {
    const below = rect.bottom + PAD + GAP;
    const above = rect.top - PAD - GAP - cardHeight;
    const top = below + cardHeight <= vh - 12 ? below : above >= 12 ? above : Math.max(12, vh - cardHeight - 12);
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), vw - width - 12);
    style = { width, left, top };
  }
  const last = index === steps.length - 1;

  return (
    <div className="no-print fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* the spotlight's shadow is the dimmer, so the highlighted control stays at full brightness */}
      {rect
        ? <div aria-hidden className="pointer-events-none fixed rounded-md transition-all duration-200 motion-reduce:transition-none"
            style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 2px hsl(var(--primary)), 0 0 0 200vmax rgb(0 0 0 / 0.6)' }} />
        : <div aria-hidden className="fixed inset-0 bg-black/60" />}
      <div ref={cardRef} style={style} className="fixed rounded-lg border bg-card p-5 text-card-foreground transition-[top,left] duration-200 motion-reduce:transition-none">
        <p className="text-fine text-muted-foreground" aria-live="polite">{index + 1} of {steps.length}</p>
        <h2 id="tour-title" className="mt-1 text-body-strong">{step.title}</h2>
        <p id="tour-body" className="mt-1 text-caption text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          {!last && <Button variant="ghost" size="sm" onClick={close} className="-ml-2.5 text-muted-foreground">Skip tour</Button>}
          <span className="flex-1" />
          {index > 0 && <Button variant="outline" size="sm" onClick={() => go(-1)}>Back</Button>}
          <Button size="sm" data-tour-primary onClick={() => go(1)}>{last ? 'Done' : index === 0 ? 'Start tour' : 'Next'}</Button>
        </div>
      </div>
    </div>
  );
}
