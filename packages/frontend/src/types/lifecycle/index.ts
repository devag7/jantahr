export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export interface OnboardingTask { id: string; title: string; description: string | null; assignedTo: string | null; dueDate: string | null; status: TaskStatus; remarks: string | null }
export interface Onboarding {
  id: string; employeeId: string; startDate: string; completedAt: string | null; tasks: OnboardingTask[]; progress: { done: number; total: number; percent: number };
  employee: { id: string; employeeCode: string; firstName: string; lastName: string; dateOfJoining?: string; department?: { name: string } | null };
}
export interface OnboardingTemplate { id: string; name: string; isActive: boolean; tasks: { id: string; title: string; assignedRole: string | null; dueInDays: number }[] }
export type SeparationType = 'RESIGNATION' | 'TERMINATION' | 'RETIREMENT' | 'ABSCONDING' | 'MUTUAL';
export interface Clearance { id: string; department: string; status: 'PENDING' | 'CLEARED' | 'NOT_APPLICABLE'; remarks: string | null }
export interface FnfSettlement {
  id: string; lastSalary: number; leaveEncashmentAmount: number; gratuityAmount: number; bonusAmount: number; deductions: number; recoveries: number; netPayable: number; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  breakdown?: { encashDays: number; wagesMonthly: number; yearsOfService: number; gratuityEligible: boolean; noticeShortfallDays: number; noticeRecovery: number; loanRecovery: number }; notes?: string[];
}
export interface Separation {
  id: string; employeeId: string; separationType: SeparationType; resignationDate: string | null; lastWorkingDate: string | null; noticePeriodDays: number; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  exitInterviewDone: boolean; exitInterviewNotes: string | null; relievingLetterIssued: boolean; experienceLetterIssued: boolean; clearances: Clearance[]; fnfSettlement: FnfSettlement | null;
  employee: { id: string; employeeCode: string; firstName: string; lastName: string; dateOfJoining: string; department: { name: string } | null; designation: { name: string } | null };
}
