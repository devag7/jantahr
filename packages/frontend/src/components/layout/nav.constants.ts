import { ADMIN, READ_ALL, canApprove } from '@/lib/permissions';
import type { Role, SessionUser } from '@/types/auth';
import type { FeatureKey } from '@/types/billing';

/**
 * Two-level navigation (docs/design-system.md rule 12): sections in the black global nav, pages in the frosted sub-nav.
 * `feature` gates a page by plan in the cloud edition; the self-hosted edition has every feature.
 * `audience` gates by reporting line instead of role: 'approvers' = admins or anyone with reportees, 'managers' = anyone with reportees.
 */
type Audience = 'approvers' | 'managers';
export interface NavItem { label: string; href: string; roles?: Role[]; audience?: Audience; feature?: FeatureKey }
export interface NavSection { key: string; label: string; items: NavItem[]; roles?: Role[]; audience?: Audience }
export type NavViewer = Pick<SessionUser, 'role' | 'hasReportees'> | null | undefined;

const PEOPLE_VIEW: Role[] = [...ADMIN, 'AUDITOR', 'PAYROLL_ADMIN'];

export const NAV: NavSection[] = [
  { key: 'home', label: 'Home', items: [{ label: 'Overview', href: '/dashboard' }] },
  {
    key: 'me', label: 'My work',
    items: [
      { label: 'Attendance', href: '/me/attendance' },
      { label: 'Leave', href: '/me/leave' },
      { label: 'Payslips', href: '/me/payslips', feature: 'payroll' },
      { label: 'Tax', href: '/me/tax', feature: 'payroll' },
      { label: 'Expenses', href: '/me/expenses', feature: 'expenses' },
      { label: 'Performance', href: '/me/performance', feature: 'performance' },
      { label: 'Helpdesk', href: '/me/helpdesk', feature: 'helpdesk' },
      { label: 'Policies', href: '/me/policies' },
      { label: 'Privacy', href: '/me/privacy' },
      { label: 'Profile', href: '/me/profile' },
    ],
  },
  { key: 'company', label: 'Company', items: [{ label: 'Directory', href: '/directory' }, { label: 'Org chart', href: '/org-chart' }] },
  {
    key: 'team', label: 'Team', audience: 'approvers',
    items: [{ label: 'Approvals', href: '/approvals', audience: 'approvers' }, { label: 'Team', href: '/team', audience: 'managers' }],
  },
  {
    key: 'people', label: 'People', roles: PEOPLE_VIEW,
    items: [
      { label: 'Employees', href: '/hr/employees' },
      { label: 'Attendance', href: '/hr/attendance' },
      { label: 'Leave', href: '/hr/leave' },
      { label: 'Onboarding & exits', href: '/hr/lifecycle', feature: 'lifecycle' },
      { label: 'Performance', href: '/hr/performance', feature: 'performance' },
      { label: 'Recruitment', href: '/hr/recruitment', feature: 'recruitment' },
    ],
  },
  {
    key: 'payroll', label: 'Payroll', roles: READ_ALL,
    items: [
      { label: 'Runs', href: '/hr/payroll', feature: 'payroll' },
      { label: 'Salary setup', href: '/hr/payroll/setup', feature: 'payroll' },
      { label: 'Statutory', href: '/hr/payroll/statutory', feature: 'statutory' },
      { label: 'Compliance', href: '/hr/compliance', feature: 'statutory' },
    ],
  },
  {
    key: 'insights', label: 'Insights', roles: READ_ALL,
    items: [
      { label: 'Reports', href: '/hr/reports', feature: 'analytics' },
      { label: 'Analytics', href: '/hr/insights', roles: [...ADMIN, 'AUDITOR'], feature: 'analytics' },
    ],
  },
  {
    key: 'admin', label: 'Admin', roles: [...ADMIN, 'AUDITOR', 'PAYROLL_ADMIN'],
    items: [
      { label: 'Data protection', href: '/hr/privacy', roles: [...ADMIN, 'AUDITOR'] },
      { label: 'Billing', href: '/hr/billing', roles: READ_ALL },
      { label: 'Settings', href: '/hr/settings', roles: ADMIN },
    ],
  },
];

const inAudience = (audience: Audience | undefined, viewer: NavViewer) =>
  !audience || (audience === 'approvers' ? canApprove(viewer) : !!viewer?.hasReportees && viewer.role !== 'AUDITOR');
const allowed = (entry: { roles?: Role[]; audience?: Audience }, viewer: NavViewer) =>
  (!entry.roles || (!!viewer?.role && entry.roles.includes(viewer.role))) && inAudience(entry.audience, viewer);

export function navFor(viewer: NavViewer): NavSection[] {
  return NAV.filter((s) => allowed(s, viewer))
    .map((s) => ({ ...s, items: s.items.filter((i) => allowed(i, viewer)) }))
    .filter((s) => s.items.length);
}

/** Longest-prefix match so /hr/payroll isn't active while on /hr/payroll/setup. */
export function isNavActive(pathname: string, href: string, all: string[]): boolean {
  if (pathname === href) return true;
  const better = all.some((h) => h !== href && h.startsWith(href + '/') && (pathname === h || pathname.startsWith(h + '/')));
  return !better && pathname.startsWith(href + '/');
}

export function locate(pathname: string, viewer: NavViewer): { section: NavSection | null; item: NavItem | null } {
  const sections = navFor(viewer);
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  for (const s of sections) {
    const item = s.items.find((i) => isNavActive(pathname, i.href, hrefs));
    if (item) return { section: s, item };
  }
  return { section: null, item: null };
}

/** Plan feature needed for a path, independent of role (used by the page gate). */
export function featureFor(pathname: string): FeatureKey | undefined {
  const all = NAV.flatMap((s) => s.items);
  const hrefs = all.map((i) => i.href);
  return all.find((i) => isNavActive(pathname, i.href, hrefs))?.feature;
}
