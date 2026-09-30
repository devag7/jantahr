import { del, get, patch, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Ok, Paginated } from '@/types/common';
import type { CompOffRequest, Encashment, LeaveAllocation, LeaveApplication, LeaveApplyInput, LeaveBalance, LeaveCalendarData, LeavePolicy, LeavePreview, LeaveType } from '@/types/leave';

export interface LeaveListFilters { scope?: 'mine' | 'team' | 'all'; status?: string; page?: number; limit?: number; employeeId?: string }

export const leaveService = {
  types: () => get<LeaveType[]>(E.leave.types),
  createType: (d: Partial<LeaveType>) => post<LeaveType>(E.leave.types, d),
  updateType: (id: string, d: Partial<LeaveType>) => patch<LeaveType>(E.leave.type(id), d),
  deleteType: (id: string) => del<Ok>(E.leave.type(id)),
  policies: () => get<LeavePolicy[]>(E.leave.policies),
  createPolicy: (d: { name: string; details: { leaveTypeId: string; annualAllocation: number }[] }) => post<LeavePolicy>(E.leave.policies, d),
  updatePolicy: (id: string, d: { name?: string; isActive?: boolean; details?: { leaveTypeId: string; annualAllocation: number }[] }) => patch<LeavePolicy>(E.leave.policy(id), d),
  assignPolicy: (id: string, d: { allEmployees?: boolean; employeeIds?: string[]; effectiveFrom?: string }) => post<{ assigned: number }>(E.leave.assign(id), d),
  allocations: (employeeId?: string) => get<LeaveAllocation[]>(E.leave.allocations, { employeeId }),
  manualAllocate: (d: { employeeId: string; leaveTypeId: string; days: number; fromDate: string; toDate: string; reason?: string }) => post<LeaveAllocation>(E.leave.allocations, d),
  runAccrual: () => post<{ credited: number }>(E.leave.accrual),
  balance: (employeeId?: string) => get<LeaveBalance[]>(E.leave.balance, { employeeId }),
  preview: (d: LeaveApplyInput) => post<LeavePreview>(E.leave.preview, d),
  apply: (d: LeaveApplyInput) => post<LeaveApplication>(E.leave.applications, d),
  list: (f: LeaveListFilters) => get<Paginated<LeaveApplication>>(E.leave.applications, f),
  pending: () => get<LeaveApplication[]>(E.leave.pending),
  approve: (id: string, comment?: string) => post<LeaveApplication>(E.leave.approve(id), { comment }),
  reject: (id: string, comment?: string) => post<LeaveApplication>(E.leave.reject(id), { comment }),
  cancel: (id: string) => post<LeaveApplication>(E.leave.cancel(id)),
  calendar: (year: number, month: number) => get<LeaveCalendarData>(E.leave.calendar, { year, month }),
  encashments: () => get<Encashment[]>(E.leave.encashments),
  requestEncashment: (d: { leaveTypeId: string; days: number }) => post<Encashment>(E.leave.encashments, d),
  decideEncashment: (id: string, a: 'approve' | 'reject') => post<Encashment>(E.leave.encashment(id, a)),
  compOff: (scope?: 'approvals') => get<CompOffRequest[]>(E.leave.compOff, { scope }),
  requestCompOff: (d: { workFromDate: string; workEndDate?: string; halfDay?: boolean; reason: string }) => post<CompOffRequest>(E.leave.compOff, d),
  decideCompOff: (id: string, a: 'approve' | 'reject', comment?: string) => post<CompOffRequest>(E.leave.compOffDecision(id, a), { comment }),
};
