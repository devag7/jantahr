export type ConsentState = 'GRANTED' | 'WITHDRAWN' | 'NOT_ASKED' | 'OUTDATED';
export interface ConsentPurposeStatus { purpose: string; label: string; description: string; required: boolean; state: ConsentState; noticeVersion: number | null; at: string | null }
export interface ConsentList { noticeVersion: number; purposes: ConsentPurposeStatus[] }

export type PrivacyRequestType = 'ACCESS' | 'CORRECTION' | 'ERASURE' | 'GRIEVANCE' | 'NOMINATION';
export type PrivacyRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
export interface PrivacyRequest { id: string; employeeId: string; type: PrivacyRequestType; details: string; status: PrivacyRequestStatus; resolution: string | null; resolvedAt: string | null; dueDate: string; createdAt: string }
export interface AdminPrivacyRequest extends PrivacyRequest { overdue: boolean; employee: { id: string; firstName: string; lastName: string; employeeCode: string; status: string } | null }

export type BreachSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BreachStatus = 'INVESTIGATING' | 'CONTAINED' | 'NOTIFIED' | 'CLOSED';
export interface DataBreach {
  id: string; title: string; description: string; severity: BreachSeverity; status: BreachStatus; occurredAt: string | null; detectedAt: string; affectedCount: number | null;
  dataCategories: string | null; containmentActions: string | null; boardNotifiedAt: string | null; principalsNotifiedAt: string | null; createdAt: string;
  boardDueAt: string; boardOverdue: boolean;
}
export interface BreachInput { title: string; description: string; severity: BreachSeverity; occurredAt?: string; affectedCount?: number; dataCategories?: string; containmentActions?: string }

export interface ErasurePlan { allowed: boolean; level?: 'PARTIAL' | 'FULL'; reason: string; retainUntil?: string }
export interface RetentionRow { id: string; employeeCode: string; firstName: string; lastName: string; lastWorkingDate: string | null; erasedAt: string | null; anonymizedAt: string | null; plan: ErasurePlan }
export interface RetentionSummary { left: number; pendingFull: number; pendingPartial: number; anonymised: number }
export interface RetentionReport { retentionYears: number; employees: RetentionRow[]; summary: RetentionSummary }
export interface PrivacyOverview { noticeVersion: number; consents: Record<string, Record<ConsentState, number>>; retention: RetentionSummary; retentionYears: number; applicantsDue: number }
export interface ErasureResult { level: 'PARTIAL' | 'FULL'; reason: string; retainUntil: string | null; erased: string[]; retained: string[] }
