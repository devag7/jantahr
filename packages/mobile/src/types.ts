export interface SessionUser {
  id: string; email: string; role: string; mustChangePassword: boolean;
  company: { name: string };
  employee: { id: string; firstName: string; fullName: string; employeeCode: string; designation: { name: string } | null; department: { name: string } | null } | null;
}
export interface PunchStatus { checkedIn: boolean; firstIn: string | null; elapsedSeconds: number; attendance: { status: string; lateEntry: boolean } | null }
export interface LeaveBalance { leaveTypeId: string; leaveType: string; available: number; used: number; allocated: number; pending: number; isLWP: boolean }
export interface LeaveApplication { id: string; fromDate: string; toDate: string; totalLeaveDays: number; status: string; leaveType: { name: string } }
export interface LeavePreview { totalDays: number; available: number }
export interface Slip { id: string; month: number; year: number; netPay: number; grossPay: number; status: string }
export interface Announcement { id: string; title: string; body: string }
export interface EssDashboard { today: PunchStatus; leaveBalances: LeaveBalance[]; announcements: Announcement[]; attendanceSummary: { present: number; wfh: number; absent: number; lateMarks: number } }
