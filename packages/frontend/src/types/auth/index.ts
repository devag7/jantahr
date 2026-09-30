export type Role = 'SUPER_ADMIN' | 'HR_ADMIN' | 'PAYROLL_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  /** Someone reports to this user (directly or upline), so they approve for them whatever their role. */
  hasReportees: boolean;
  company: { id: string; name: string; legalName: string; state: string | null; logo: string | null };
  employee: {
    id: string; employeeCode: string; firstName: string; lastName: string; fullName: string; profileImage: string | null;
    department: { id: string; name: string } | null; designation: { id: string; name: string } | null; dateOfJoining: string;
  } | null;
}

/** Company details for a new workspace; kept in the Supabase user's metadata until the email is confirmed. */
export interface CompanyDetails { companyName: string; state?: string; firstName: string; lastName?: string }
export interface SignupInput extends CompanyDetails { email: string; password: string }
export interface TotpEnrolment { factorId: string; secret: string; uri: string; qrCode: string }
