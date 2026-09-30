export interface LeaveType {
  id: string; name: string; maxDaysAllowed: number | null; isCarryForward: boolean; maxCarryForwardDays: number | null; isEncashable: boolean; maxEncashableDays: number | null;
  isEarnedLeave: boolean; isLWP: boolean; isCompensatory: boolean; includeHolidays: boolean; sandwichRule: boolean; allowNegativeBalance: boolean; isPaid: boolean;
  maxContinuousDays: number | null; applicableGender: 'MALE' | 'FEMALE' | 'OTHER' | null;
}
export interface LeaveBalance { leaveTypeId: string; leaveType: string; allocated: number; carryForwarded: number; used: number; pending: number; available: number; isLWP: boolean; isEncashable: boolean; isPaid: boolean }
export type LeaveStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export interface LeaveApplication {
  id: string; employeeId: string; leaveTypeId: string; fromDate: string; toDate: string; totalLeaveDays: number; halfDay: boolean; halfDayDate: string | null; reason: string | null;
  status: LeaveStatus; approverComment: string | null; createdAt: string; leaveType: { id: string; name: string; isLWP: boolean };
  employee: { id: string; employeeCode: string; firstName: string; lastName: string; department: { name: string } | null };
}
export interface LeaveApplyInput { leaveTypeId: string; fromDate: string; toDate: string; halfDay?: boolean; halfDayDate?: string; reason?: string; employeeId?: string }
export interface LeavePreview { totalDays: number; countedDates: string[]; excludedDates: string[]; available: number; leaveType: string }
export interface LeavePolicyDetail { leaveTypeId: string; annualAllocation: number; leaveType?: { id: string; name: string } }
export interface LeavePolicy { id: string; name: string; isActive: boolean; details: LeavePolicyDetail[]; _count: { assignments: number } }
export interface LeaveCalendarData {
  leaves: { id: string; employeeId: string; employee: string; leaveType: string; from: string; to: string; status: LeaveStatus; days: number }[];
  holidays: { date: string; name: string }[]; weeklyOffDays: number[];
}
export interface Encashment { id: string; encashableDays: number; encashmentAmount: number; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string; employee: { firstName: string; lastName: string; employeeCode: string }; leaveType: { name: string } }
export interface CompOffRequest { id: string; workFromDate: string; workEndDate: string; halfDay: boolean; reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; employee: { firstName: string; lastName: string; employeeCode: string } }
export interface LeaveAllocation { id: string; fromDate: string; toDate: string; totalLeavesAllocated: number; usedLeaves: number; employee: { firstName: string; lastName: string; employeeCode: string }; leaveType: { name: string } }
