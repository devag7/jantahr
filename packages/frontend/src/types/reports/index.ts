import type { LeaveBalance } from '@/types/leave';
import type { MonthSummary, PunchStatus } from '@/types/attendance';
import type { Announcement } from '@/types/engagement';

export interface Celebration { id: string; name: string; department?: string; in: number; years?: number }
export interface Celebrations { birthdays: Celebration[]; anniversaries: Celebration[] }
export interface NamedCount { name: string; count: number }
export interface AdminDashboard {
  headcount: { active: number; joinersThisMonth: number; exitsThisFY: number; attritionRatePercent: number };
  byDepartment: NamedCount[]; byGender: NamedCount[]; byEmploymentType: NamedCount[];
  attendanceToday: { present: number; halfDay: number; absent: number; onLeave: number; notMarked: number };
  pending: { leave: number; attendanceRequests: number; expenses: number; taxDeclarations: number; helpdesk: number; overdueOnboarding: number; separations: number };
  payrollTrend: { label: string; gross: number; net: number; employerCost: number; headcount: number; status: string }[];
  recruitment: { openPositions: number; activeApplicants: number }; celebrations: Celebrations;
}
export interface ManagerDashboard {
  teamSize: number; presentToday: number; onLeaveToday: number; pending: { leave: number; attendanceRequests: number; expenses: number };
  team: { id: string; name: string; code: string; designation?: string; presentToday: boolean }[]; upcomingLeaves: { employee: string; type: string; from: string; to: string }[]; celebrations: Celebrations;
}
export interface EssDashboard {
  profile: { name: string; code: string; designation?: string; department?: string; manager: string | null; dateOfJoining: string };
  today: PunchStatus; attendanceSummary: MonthSummary; leaveBalances: LeaveBalance[]; openLeaveRequests: { id: string; type: string; from: string; to: string; days: number }[];
  latestPayslips: { id: string; month: number; year: number; net: number; status: string }[]; announcements: Announcement[]; upcomingHolidays: { date: string; name: string }[];
  pendingPolicies: { id: string; title: string }[]; onboardingTasks: { id: string; title: string; dueDate: string | null }[];
  pendingApprovals: { leave: number; attendance: number; expenses: number; total: number } | null; celebrations: Celebrations;
}
export interface MisCatalogItem { key: string; title: string; description: string; params: string[] }
export interface MisReport { title: string; columns: string[]; rows: Record<string, string | number | null>[]; summary?: Record<string, unknown> }
export interface CustomCatalogEntity { entity: string; label: string; fields: { key: string; label: string }[] }
export interface CustomReportInput { entity: string; columns: string[]; filters?: { field: string; op: 'eq' | 'ne' | 'contains' | 'gte' | 'lte' | 'in'; value: string }[]; sortBy?: string; sortDir?: 'asc' | 'desc' }
export interface CustomReportResult { columns: { key: string; label: string }[]; rows: Record<string, string | number | null>[]; total: number; truncated: boolean }
