import { Role } from '@prisma/client';

export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  companyId: string;
  employeeId: string | null;
}

/** The verified Supabase Auth session behind a request (set by AuthGuard). */
export interface AuthSession {
  authId: string;
  email: string;
  aal: 'aal1' | 'aal2';
  /** How the user proved who they are: password, otp, magiclink, recovery, oauth, totp… */
  methods: string[];
  sessionId: string | null;
  issuedAt: number;
  metadata: Record<string, unknown>;
}

export const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN];
export const PAYROLL_ROLES: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.PAYROLL_ADMIN];
export const READ_ALL_ROLES: Role[] = [...PAYROLL_ROLES, Role.AUDITOR];
/**
 * Roles that can hold approval rights. Approval follows the reporting line, not the MANAGER role:
 * admins approve for anyone, the rest only for their reportees (AccessService.canApproveFor decides per request).
 */
export const APPROVER_ROLES: Role[] = Object.values(Role).filter((r) => r !== Role.AUDITOR);
/** Team/company read views (employee list, daily attendance, anomalies…): back office plus the MANAGER role. */
export const TEAM_VIEW_ROLES: Role[] = [...READ_ALL_ROLES, Role.MANAGER];
