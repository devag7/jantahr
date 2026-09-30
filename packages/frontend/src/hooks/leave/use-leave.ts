'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { leaveService, type LeaveListFilters } from '@/services/leave/leave.service';
import type { LeaveApplyInput, LeaveType } from '@/types/leave';

const ALL = [['leave'], ['reports'], ['attendance']] as const;

export const useLeaveTypes = () => useQuery({ queryKey: ['leave', 'types'], queryFn: leaveService.types, staleTime: 60_000 });
export const useLeavePolicies = () => useQuery({ queryKey: ['leave', 'policies'], queryFn: leaveService.policies });
export const useLeaveBalance = (employeeId?: string) => useQuery({ queryKey: ['leave', 'balance', employeeId], queryFn: () => leaveService.balance(employeeId) });
export const useLeaveList = (f: LeaveListFilters) => useQuery({ queryKey: ['leave', 'list', f], queryFn: () => leaveService.list(f), placeholderData: keepPreviousData });
export const useLeavePending = () => useQuery({ queryKey: ['leave', 'pending'], queryFn: leaveService.pending });
export const useLeaveCalendar = (year: number, month: number) => useQuery({ queryKey: ['leave', 'calendar', year, month], queryFn: () => leaveService.calendar(year, month) });
export const useLeaveAllocations = (employeeId?: string) => useQuery({ queryKey: ['leave', 'allocations', employeeId], queryFn: () => leaveService.allocations(employeeId) });
export const useEncashments = () => useQuery({ queryKey: ['leave', 'encashments'], queryFn: leaveService.encashments });
export const useCompOff = (scope?: 'approvals') => useQuery({ queryKey: ['leave', 'comp-off', scope], queryFn: () => leaveService.compOff(scope) });

export const useLeavePreview = () => useApiMutation((d: LeaveApplyInput) => leaveService.preview(d), { silentError: true });
export const useApplyLeave = () => useApiMutation((d: LeaveApplyInput) => leaveService.apply(d), { invalidate: [...ALL], success: 'Leave request submitted' });
export const useApproveLeave = () => useApiMutation((v: { id: string; comment?: string }) => leaveService.approve(v.id, v.comment), { invalidate: [...ALL], success: 'Leave approved' });
export const useRejectLeave = () => useApiMutation((v: { id: string; comment?: string }) => leaveService.reject(v.id, v.comment), { invalidate: [...ALL], success: 'Leave rejected' });
export const useCancelLeave = () => useApiMutation((id: string) => leaveService.cancel(id), { invalidate: [...ALL], success: 'Leave cancelled' });
export const useCreateLeaveType = () => useApiMutation((d: Partial<LeaveType>) => leaveService.createType(d), { invalidate: [['leave']], success: 'Leave type created' });
export const useUpdateLeaveType = () => useApiMutation((v: { id: string; data: Partial<LeaveType> }) => leaveService.updateType(v.id, v.data), { invalidate: [['leave']], success: 'Leave type saved' });
export const useDeleteLeaveType = () => useApiMutation(leaveService.deleteType, { invalidate: [['leave']], success: 'Leave type deleted' });
export const useSavePolicy = () => useApiMutation((v: { id?: string; name: string; details: { leaveTypeId: string; annualAllocation: number }[] }) => (v.id ? leaveService.updatePolicy(v.id, v) : leaveService.createPolicy(v)), { invalidate: [['leave']], success: 'Policy saved' });
export const useAssignPolicy = () => useApiMutation((v: { id: string; allEmployees?: boolean; employeeIds?: string[] }) => leaveService.assignPolicy(v.id, v), { invalidate: [['leave']], success: (r) => `Policy assigned to ${r.assigned} employee(s)` });
export const useManualAllocate = () => useApiMutation(leaveService.manualAllocate, { invalidate: [['leave']], success: 'Leave credited' });
export const useRunAccrual = () => useApiMutation(() => leaveService.runAccrual(), { invalidate: [['leave']], success: (r) => `${r.credited} accrual credit(s) posted` });
export const useRequestEncashment = () => useApiMutation(leaveService.requestEncashment, { invalidate: [['leave']], success: 'Encashment requested' });
export const useDecideEncashment = () => useApiMutation((v: { id: string; action: 'approve' | 'reject' }) => leaveService.decideEncashment(v.id, v.action), { invalidate: [['leave']], success: 'Updated' });
export const useRequestCompOff = () => useApiMutation(leaveService.requestCompOff, { invalidate: [['leave']], success: 'Comp-off requested' });
export const useDecideCompOff = () => useApiMutation((v: { id: string; action: 'approve' | 'reject' }) => leaveService.decideCompOff(v.id, v.action), { invalidate: [['leave']], success: 'Updated' });
