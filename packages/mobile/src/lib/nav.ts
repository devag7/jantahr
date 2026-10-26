import { router } from 'expo-router';

/** Leave a form: back to where it was opened from, or to `fallback` when it was opened directly (a link). */
export const closeForm = (fallback: string) => (router.canGoBack() ? router.back() : router.replace(fallback as never));

/** Web links in notifications that have a screen in the app. */
export function screenFor(link: string | null): string | null {
  if (!link) return null;
  if (link.startsWith('/approvals')) return '/approvals';
  if (link.startsWith('/me/leave') || link.startsWith('/leave')) return '/leave';
  if (link.startsWith('/me/attendance') || link.startsWith('/attendance')) return '/attendance';
  if (link.startsWith('/me/payslips') || link.startsWith('/payroll/payslips')) return '/payslips';
  if (link.startsWith('/me/expenses') || link.startsWith('/expenses')) return '/expenses';
  if (link.startsWith('/me/policies') || link.startsWith('/policies')) return '/policies';
  return null;
}
