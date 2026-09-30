'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { attendanceService } from '@/services/attendance/attendance.service';
import type { MarkInput } from '@/services/attendance/attendance.service';
import type { PunchInput, RequestType, ShiftType } from '@/types/attendance';

const ALL = [['attendance'], ['reports']] as const;

export const usePunchStatus = () => useQuery({ queryKey: ['attendance', 'status'], queryFn: attendanceService.status, refetchInterval: 60_000 });
export const useMonthLog = (year: number, month: number, employeeId?: string) => useQuery({ queryKey: ['attendance', 'log', year, month, employeeId], queryFn: () => attendanceService.monthLog(year, month, employeeId) });
export const useDailyAttendance = (date?: string, departmentId?: string, search?: string) => useQuery({ queryKey: ['attendance', 'daily', date, departmentId, search], queryFn: () => attendanceService.daily(date, departmentId, search) });
export const useAttendanceSummary = (year: number, month: number, departmentId?: string) => useQuery({ queryKey: ['attendance', 'summary', year, month, departmentId], queryFn: () => attendanceService.summary(year, month, departmentId) });
export const useAttendanceRequests = (status?: string, scope?: 'approvals') => useQuery({ queryKey: ['attendance', 'requests', status, scope], queryFn: () => attendanceService.requests(status, scope) });
export const useShifts = () => useQuery({ queryKey: ['attendance', 'shifts'], queryFn: attendanceService.shifts, staleTime: 60_000 });
export const useShiftAssignments = () => useQuery({ queryKey: ['attendance', 'assignments'], queryFn: attendanceService.assignments });
export const useGeoLocations = () => useQuery({ queryKey: ['attendance', 'locations'], queryFn: attendanceService.locations });
export const useDevices = () => useQuery({ queryKey: ['attendance', 'devices'], queryFn: attendanceService.devices });

export const usePunch = () => useApiMutation((d: PunchInput) => attendanceService.punch(d), { invalidate: [...ALL], success: (r) => (r.checkedIn ? 'Checked in' : 'Checked out') });
export const useMarkAttendance = () => useApiMutation((d: MarkInput) => attendanceService.mark(d), { invalidate: [...ALL], success: 'Attendance saved' });
export const useImportAttendance = () => useApiMutation(attendanceService.importCsv, { invalidate: [...ALL] });
export const useProcessAttendance = () => useApiMutation((v: { from: string; to: string }) => attendanceService.process(v.from, v.to), { invalidate: [...ALL], success: (r) => `${r.processed} day(s) processed` });
export const useMarkAbsent = () => useApiMutation((v: { from: string; to: string }) => attendanceService.markAbsent(v.from, v.to), { invalidate: [...ALL], success: (r) => `${r.marked} absent record(s) created` });
export const useCreateRequest = () => useApiMutation((d: { fromDate: string; toDate?: string; requestType: RequestType; halfDay?: boolean; reason: string }) => attendanceService.createRequest(d), { invalidate: [...ALL], success: 'Request submitted for approval' });
export const useDecideRequest = () => useApiMutation((v: { id: string; action: 'approve' | 'reject'; comment?: string }) => attendanceService.decideRequest(v.id, v.action, v.comment), { invalidate: [...ALL], success: 'Request updated' });
export const useSaveShift = () => useApiMutation((v: { id?: string; data: Partial<ShiftType> }) => (v.id ? attendanceService.updateShift(v.id, v.data) : attendanceService.createShift(v.data)), { invalidate: [['attendance', 'shifts']], success: 'Shift saved' });
export const useDeleteShift = () => useApiMutation(attendanceService.deleteShift, { invalidate: [['attendance', 'shifts']], success: 'Shift deleted' });
export const useAssignShift = () => useApiMutation(attendanceService.assignShift, { invalidate: [['attendance', 'assignments']], success: (r) => `Shift assigned to ${r.assigned} employee(s)` });
export const useRoster = () => useApiMutation(attendanceService.roster, { invalidate: [['attendance', 'assignments']], success: (r) => `${r.created} roster entries created` });
export const useRemoveAssignment = () => useApiMutation(attendanceService.removeAssignment, { invalidate: [['attendance', 'assignments']] });
export const useCreateLocation = () => useApiMutation(attendanceService.createLocation, { invalidate: [['attendance', 'locations']], success: 'Location added' });
export const useDeleteLocation = () => useApiMutation(attendanceService.deleteLocation, { invalidate: [['attendance', 'locations']], success: 'Location removed' });
export const useCreateDevice = () => useApiMutation(attendanceService.createDevice, { invalidate: [['attendance', 'devices']] });
export const useSetDeviceActive = () => useApiMutation((v: { id: string; isActive: boolean }) => attendanceService.setDeviceActive(v.id, v.isActive), { invalidate: [['attendance', 'devices']] });
