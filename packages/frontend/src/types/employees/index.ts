import type { Role } from '@/types/auth';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LEFT';

export interface Employee {
  id: string; employeeCode: string; firstName: string; middleName: string | null; lastName: string; fullName: string; email: string; personalEmail: string | null; phone: string | null;
  dateOfBirth: string | null; gender: Gender; maritalStatus: string; bloodGroup: string | null; fatherName: string | null; currentAddress: string | null; permanentAddress: string | null;
  city: string | null; state: string | null; pincode: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null; emergencyContactRelation: string | null;
  dateOfJoining: string; lastWorkingDate: string | null; status: EmployeeStatus; employmentType: string | null; workLocation: string | null; noticeperiodDays: number | null;
  departmentId: string | null; designationId: string | null; reportingManagerId: string | null;
  department: { id: string; name: string } | null; designation: { id: string; name: string } | null;
  reportingManager: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  reportees?: { id: string; firstName: string; lastName: string; employeeCode: string }[];
  bankName: string | null; bankAccountNumber: string | null; ifscCode: string | null; panNumber: string | null; aadhaarNumber: string | null; uanNumber: string | null; esicNumber: string | null;
  professionalTaxState: string | null; ctc?: number | null; pfApplicable: boolean; esiApplicable: boolean; ptApplicable: boolean;
  user: { role: Role; email: string; isActive: boolean; lastLogin: string | null; mfaEnabled: boolean };
  temporaryPassword?: string;
}

export interface DirectoryEntry {
  id: string; employeeCode: string; fullName: string; email: string; phone?: string | null; department: string | null; designation: string | null; manager: string | null;
  workLocation: string | null; dateOfJoining: string;
}

export interface OrgNode { id: string; employeeCode: string; name: string; designation?: string; department?: string; children: OrgNode[] }

export interface EmployeeDocument { id: string; documentType: string; documentName: string; fileUrl: string; expiryDate: string | null; verifiedAt: string | null; createdAt: string }

export interface EmployeeFilters { page?: number; limit?: number; search?: string; departmentId?: string; status?: EmployeeStatus; employmentType?: string }

export interface EmployeeInput {
  firstName: string; lastName: string; middleName?: string; email: string; phone?: string; gender: Gender; dateOfBirth?: string; maritalStatus?: string; dateOfJoining: string;
  employmentType?: string; departmentId?: string; designationId?: string; reportingManagerId?: string; workLocation?: string; state?: string; city?: string; currentAddress?: string;
  panNumber?: string; aadhaarNumber?: string; uanNumber?: string; bankName?: string; bankAccountNumber?: string; ifscCode?: string; ctc?: number; role?: Role; noticeperiodDays?: number;
  pfApplicable?: boolean; esiApplicable?: boolean; ptApplicable?: boolean; professionalTaxState?: string; employeeCode?: string;
}

export interface ImportResult { total: number; createdCount: number; failedCount: number; created: { row: number; employeeCode: string; email: string; temporaryPassword: string }[]; failed: { row: number; email?: string; error: string }[] }
