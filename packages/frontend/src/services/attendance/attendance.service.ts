import { del, get, patch, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Ok } from '@/types/common';
import type {
  AttendanceRequest, AttendanceSummaryRow, BiometricDevice, DailyAttendance, DeviceCreated, GeoLocation, MonthLog, PunchInput, PunchStatus, RequestType, ShiftAssignment, ShiftType,
} from '@/types/attendance';

export interface MarkInput { employeeId: string; date: string; status: string; inTime?: string; outTime?: string; remarks?: string }

export const attendanceService = {
  punch: (d: PunchInput) => post<PunchStatus>(E.attendance.punch, d),
  status: () => get<PunchStatus>(E.attendance.status),
  monthLog: (year: number, month: number, employeeId?: string) => get<MonthLog>(E.attendance.me, { year, month, employeeId }),
  daily: (date?: string, departmentId?: string, search?: string) => get<DailyAttendance>(E.attendance.daily, { date, departmentId, search, limit: 200 }),
  summary: (year: number, month: number, departmentId?: string) => get<AttendanceSummaryRow[]>(E.attendance.summary, { year, month, departmentId }),
  mark: (d: MarkInput) => post<Ok>(E.attendance.mark, d),
  importCsv: (csv: string) => post<{ total: number; imported: number; failed: number; errors: { row: number; error: string }[] }>(E.attendance.import, { csv }),
  process: (from: string, to: string) => post<{ days: number; processed: number }>(E.attendance.process, { from, to }),
  markAbsent: (from: string, to: string) => post<{ marked: number }>(E.attendance.markAbsent, { from, to }),
  requests: (status?: string, scope?: 'approvals') => get<AttendanceRequest[]>(E.attendance.requests, { status, scope }),
  createRequest: (d: { fromDate: string; toDate?: string; requestType: RequestType; halfDay?: boolean; reason: string }) => post<AttendanceRequest>(E.attendance.requests, d),
  decideRequest: (id: string, a: 'approve' | 'reject', comment?: string) => post<AttendanceRequest>(E.attendance.requestDecision(id, a), { comment }),
  shifts: () => get<ShiftType[]>(E.attendance.shifts),
  createShift: (d: Partial<ShiftType>) => post<ShiftType>(E.attendance.shifts, d),
  updateShift: (id: string, d: Partial<ShiftType>) => patch<ShiftType>(E.attendance.shift(id), d),
  deleteShift: (id: string) => del<Ok>(E.attendance.shift(id)),
  assignments: () => get<ShiftAssignment[]>(E.attendance.assignments),
  assignShift: (d: { employeeIds: string[]; shiftTypeId: string; startDate: string; endDate?: string }) => post<{ assigned: number }>(E.attendance.assignments, d),
  roster: (d: { employeeIds: string[]; pattern: string[]; startDate: string; weeks: number }) => post<{ created: number }>(E.attendance.roster, d),
  removeAssignment: (id: string) => del<Ok>(E.attendance.assignment(id)),
  locations: () => get<GeoLocation[]>(E.attendance.locations),
  createLocation: (d: Omit<GeoLocation, 'id'>) => post<GeoLocation>(E.attendance.locations, d),
  deleteLocation: (id: string) => del<Ok>(E.attendance.location(id)),
  devices: () => get<BiometricDevice[]>(E.attendance.devices),
  createDevice: (d: { name: string; serialNo: string; vendor?: string }) => post<DeviceCreated>(E.attendance.devices, d),
  setDeviceActive: (id: string, isActive: boolean) => post<{ id: string; isActive: boolean }>(E.attendance.deviceActive(id), { isActive }),
};
