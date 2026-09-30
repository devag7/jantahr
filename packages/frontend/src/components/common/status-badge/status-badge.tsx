import { Badge } from '@/components/ui/badge';
import { humanize } from '@/lib/format';

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'muted' | 'default';

/** Status → colour, shared by every workflow (leave, payroll, expenses, tickets, hiring...). */
const TONE: Record<string, Tone> = {
  APPROVED: 'success', PAID: 'success', PRESENT: 'success', COMPLETED: 'success', CLEARED: 'success', ACTIVE: 'success', ACCEPTED: 'success', HIRED: 'success', RESOLVED: 'success', REIMBURSED: 'success', OPEN_JOB: 'success', VERIFIED: 'success',
  PENDING: 'warning', OPEN: 'warning', SUBMITTED: 'warning', GENERATED: 'warning', HALF_DAY: 'warning', SCREENING: 'warning', SENT: 'warning', IN_PROGRESS: 'info', SELF_REVIEW: 'info', MANAGER_REVIEW: 'info', HR_REVIEW: 'info', SCHEDULED: 'info', INTERVIEW: 'info',
  REJECTED: 'destructive', ABSENT: 'destructive', CANCELLED: 'muted', DECLINED: 'destructive', NO_SHOW: 'destructive', LEFT: 'muted', INACTIVE: 'muted', SUSPENDED: 'destructive', URGENT: 'destructive', HIGH: 'destructive',
  ON_LEAVE: 'info', WORK_FROM_HOME: 'info', APPLIED: 'muted', OFFER: 'info', DRAFT: 'muted', CLOSED: 'muted', SKIPPED: 'muted', NOT_APPLICABLE: 'muted', NOT_MARKED: 'muted', HOLIDAY: 'muted', WEEKLY_OFF: 'muted', ON_HOLD: 'warning', MEDIUM: 'warning', LOW: 'muted',
  GRANTED: 'success', WITHDRAWN: 'destructive', NOT_ASKED: 'muted', OUTDATED: 'warning', INVESTIGATING: 'warning', CONTAINED: 'info', NOTIFIED: 'info', CRITICAL: 'destructive',
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  return <Badge variant={TONE[status] ?? 'muted'} className={className}>{label ?? humanize(status)}</Badge>;
}
