import type { Role, SessionUser } from '@/types/auth';

export const ADMIN: Role[] = ['SUPER_ADMIN', 'HR_ADMIN'];
export const PAYROLL: Role[] = ['SUPER_ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN'];
export const READ_ALL: Role[] = [...PAYROLL, 'AUDITOR'];
export const can = (role: Role | undefined, allowed: Role[]) => !!role && allowed.includes(role);
/** Approvals follow the reporting line: admins approve for anyone, everyone else (except auditors) for their reportees. */
export const canApprove = (user: Pick<SessionUser, 'role' | 'hasReportees'> | null | undefined) => !!user && (can(user.role, ADMIN) || (user.role !== 'AUDITOR' && !!user.hasReportees));
export const isBackOffice = (role: Role | undefined) => can(role, READ_ALL);
