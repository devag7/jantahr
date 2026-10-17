import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Alert, Platform } from 'react-native';
import type { AttendanceRequest, MonthLog, PunchInput, PunchStatus, RequestType } from '@/types/attendance';
import type { Entitlements, FeatureKey } from '@/types/billing';
import type { Paginated } from '@/types/common';
import type { Employee, EmployeeDocument } from '@/types/employees';
import type { AppNotification, NotificationList, Policy } from '@/types/engagement';
import type { ExpenseClaim, TravelRequest } from '@/types/expenses';
import type { CompOffRequest, LeaveApplication, LeaveApplyInput, LeaveBalance, LeavePreview, LeaveType } from '@/types/leave';
import type { CalendarHoliday } from '@/types/org';
import type { Slip } from '@/types/payroll';
import type { Separation } from '@/types/lifecycle';
import type { PendingGoal } from '@/types/performance';
import type { EssDashboard, ManagerDashboard } from '@/types/reports';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/ui/overlays';

/** A write that refreshes what it changed, confirms with a toast and explains failures in plain words. */
export function useAction<V, R>(fn: (v: V) => Promise<R>, opts: { invalidate?: QueryKey[]; success?: string | ((r: R) => string) } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const key of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(r) : opts.success);
    },
    // a dialog on the phone (it must be read); the browser preview has no native dialogs
    onError: (e) => (Platform.OS === 'web' ? toast(errorMessage(e), 'error') : Alert.alert('That did not work', errorMessage(e))),
  });
}

// ---------- home ----------
export const useEss = () => useQuery({ queryKey: ['ess'], queryFn: () => api.get<EssDashboard>('/reports/dashboard/ess') });
export const useManagerDashboard = (enabled: boolean) => useQuery({ queryKey: ['manager'], queryFn: () => api.get<ManagerDashboard>('/reports/dashboard/manager'), enabled });
export const useEntitlements = () => useQuery({ queryKey: ['entitlements'], queryFn: () => api.get<Entitlements>('/billing/entitlements'), staleTime: 5 * 60_000 });
/** Features outside the company's plan are hidden rather than shown and refused (no purchase screens in the app). */
export function useHasFeature(feature: FeatureKey) {
  const e = useEntitlements();
  return !e.data || e.data.features.includes(feature) || e.data.readOnlyFeatures.includes(feature);
}

// ---------- attendance ----------
export const usePunchStatus = () => useQuery({ queryKey: ['punch'], queryFn: () => api.get<PunchStatus>('/attendance/status'), refetchInterval: 60_000 });
export const usePunch = () => useAction((d: PunchInput) => api.post<PunchStatus>('/attendance/punch', d), {
  invalidate: [['punch'], ['ess'], ['attendance']], success: (s) => (s.checkedIn ? 'Checked in' : 'Checked out'),
});
export const useMonthLog = (year: number, month: number) => useQuery({ queryKey: ['attendance', 'month', year, month], queryFn: () => api.get<MonthLog>('/attendance/me', { year, month }) });
export const useMyAttendanceRequests = () => useQuery({ queryKey: ['attendance', 'requests', 'mine'], queryFn: () => api.get<AttendanceRequest[]>('/attendance/requests') });
export const useCreateAttendanceRequest = () => useAction(
  (d: { fromDate: string; toDate?: string; requestType: RequestType; halfDay?: boolean; reason: string }) => api.post<AttendanceRequest>('/attendance/requests', d),
  { invalidate: [['attendance'], ['approvals']], success: 'Request sent for approval' },
);

// ---------- leave ----------
export const useLeaveBalance = () => useQuery({ queryKey: ['leave', 'balance'], queryFn: () => api.get<LeaveBalance[]>('/leave/balance') });
export const useLeaveTypes = () => useQuery({ queryKey: ['leave', 'types'], queryFn: () => api.get<LeaveType[]>('/leave/types'), staleTime: 10 * 60_000 });
export const useMyLeaves = () => useQuery({ queryKey: ['leave', 'mine'], queryFn: () => api.get<Paginated<LeaveApplication>>('/leave/applications', { scope: 'mine', limit: 50 }) });
export const previewLeave = (d: LeaveApplyInput) => api.post<LeavePreview>('/leave/preview', d);
export const useApplyLeave = () => useAction((d: LeaveApplyInput) => api.post<LeaveApplication>('/leave/applications', d), {
  invalidate: [['leave'], ['ess'], ['approvals']], success: 'Leave applied. Your manager has been told.',
});
export const useCancelLeave = () => useAction((id: string) => api.post<LeaveApplication>(`/leave/applications/${id}/cancel`), { invalidate: [['leave'], ['ess']], success: 'Leave cancelled' });
export const useHolidays = (year: number) => useQuery({ queryKey: ['holidays', year], queryFn: () => api.get<CalendarHoliday[]>('/holidays/calendar', { year }), staleTime: 60 * 60_000 });
export const useMyCompOff = () => useQuery({ queryKey: ['leave', 'comp-off', 'mine'], queryFn: () => api.get<CompOffRequest[]>('/leave/comp-off') });
export const useRequestCompOff = () => useAction(
  (d: { workFromDate: string; workEndDate?: string; halfDay?: boolean; reason: string }) => api.post<CompOffRequest>('/leave/comp-off', d),
  { invalidate: [['leave'], ['approvals']], success: 'Comp-off request sent' },
);

// ---------- pay ----------
export const useMySlips = () => useQuery({ queryKey: ['slips'], queryFn: () => api.get<Slip[]>('/payroll/payslips/me') });
export const useSlip = (id: string) => useQuery({ queryKey: ['slips', id], queryFn: () => api.get<Slip>(`/payroll/payslips/${id}`) });

// ---------- expenses ----------
export const useExpenseCategories = () => useQuery({ queryKey: ['expenses', 'categories'], queryFn: () => api.get<string[]>('/expenses/categories'), staleTime: 10 * 60_000 });
export const useMyClaims = () => useQuery({ queryKey: ['expenses', 'mine'], queryFn: () => api.get<ExpenseClaim[]>('/expenses/claims', { scope: 'mine' }) });
export const useCreateClaim = () => useAction(
  (d: { title: string; items: { expenseDate: string; category: string; description?: string; amount: number; receiptUrl?: string }[]; submit?: boolean }) => api.post<ExpenseClaim>('/expenses/claims', d),
  { invalidate: [['expenses'], ['approvals']], success: (c) => (c.status === 'SUBMITTED' ? 'Claim submitted for approval' : 'Claim saved as a draft') },
);
export const useSubmitClaim = () => useAction((id: string) => api.post<ExpenseClaim>(`/expenses/claims/${id}/submit`), { invalidate: [['expenses'], ['approvals']], success: 'Claim submitted for approval' });
export const useDeleteClaim = () => useAction((id: string) => api.del(`/expenses/claims/${id}`), { invalidate: [['expenses']], success: 'Draft deleted' });

// ---------- me ----------
export const useMyProfile = () => useQuery({ queryKey: ['me', 'employee'], queryFn: () => api.get<Employee>('/employees/me') });
export const useUpdateMyProfile = () => useAction((d: Partial<Employee>) => api.patch<Employee>('/employees/me', d), { invalidate: [['me']], success: 'Profile updated' });
export const useMyDocuments = (employeeId?: string) => useQuery({ queryKey: ['me', 'documents', employeeId], queryFn: () => api.get<EmployeeDocument[]>(`/employees/${employeeId}/documents`), enabled: !!employeeId });
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => api.get<NotificationList>('/notifications'), refetchInterval: 120_000 });
export const useMarkRead = () => useAction((n: AppNotification) => api.patch(`/notifications/${n.id}/read`), { invalidate: [['notifications']] });
export const useMarkAllRead = () => useAction(() => api.post('/notifications/read-all'), { invalidate: [['notifications']], success: 'All caught up' });
export const usePolicies = () => useQuery({ queryKey: ['policies'], queryFn: () => api.get<Policy[]>('/policies') });
export const useAcknowledge = () => useAction((id: string) => api.post(`/policies/${id}/acknowledge`), { invalidate: [['policies'], ['ess']], success: 'Acknowledged' });

// ---------- approvals ----------
export type Decision = 'approve' | 'reject';
export const usePendingLeave = (on: boolean) => useQuery({ queryKey: ['approvals', 'leave'], queryFn: () => api.get<LeaveApplication[]>('/leave/applications/pending'), enabled: on });
export const usePendingAttendance = (on: boolean) => useQuery({ queryKey: ['approvals', 'attendance'], queryFn: () => api.get<AttendanceRequest[]>('/attendance/requests', { status: 'PENDING', scope: 'approvals' }), enabled: on });
export const usePendingClaims = (on: boolean) => useQuery({ queryKey: ['approvals', 'expenses'], queryFn: () => api.get<ExpenseClaim[]>('/expenses/claims', { scope: 'team', status: 'SUBMITTED' }), enabled: on });
export const usePendingTravel = (on: boolean) => useQuery({
  queryKey: ['approvals', 'travel'], enabled: on,
  queryFn: async () => (await api.get<TravelRequest[]>('/expenses/travel', { scope: 'team' })).filter((t) => t.status === 'PENDING'),
});
export const usePendingCompOff = (on: boolean) => useQuery({
  queryKey: ['approvals', 'comp-off'], enabled: on,
  queryFn: async () => (await api.get<CompOffRequest[]>('/leave/comp-off', { scope: 'approvals' })).filter((c) => c.status === 'PENDING'),
});
export const usePendingGoals = (on: boolean) => useQuery({ queryKey: ['approvals', 'goals'], queryFn: () => api.get<PendingGoal[]>('/performance/goals/pending'), enabled: on });
/** Resignations waiting for a decision, except the approver's own. */
export const usePendingSeparations = (on: boolean, myEmployeeId?: string) => useQuery({
  queryKey: ['approvals', 'separations'], enabled: on,
  queryFn: async () => (await api.get<Separation[]>('/lifecycle/separations')).filter((s) => s.status === 'PENDING' && s.employee.id !== myEmployeeId),
});

const decided = (d: Decision) => (d === 'approve' ? 'Approved' : 'Rejected');
const decide = (path: (id: string, d: Decision) => string) => ({ id, decision, comment }: { id: string; decision: Decision; comment?: string }) =>
  api.post(path(id, decision), comment ? { comment } : {});
const approvalsKeys: QueryKey[] = [['approvals'], ['ess'], ['manager']];
export const useDecideLeave = () => useAction(decide((id, d) => `/leave/applications/${id}/${d}`), { invalidate: approvalsKeys, success: 'Done' });
export const useDecideAttendance = () => useAction(decide((id, d) => `/attendance/requests/${id}/${d}`), { invalidate: approvalsKeys, success: 'Done' });
export const useDecideClaim = () => useAction(decide((id, d) => `/expenses/claims/${id}/${d}`), { invalidate: approvalsKeys, success: 'Done' });
export const useDecideTravel = () => useAction(decide((id, d) => `/expenses/travel/${id}/${d}`), { invalidate: approvalsKeys, success: 'Done' });
export const useDecideCompOff = () => useAction(decide((id, d) => `/leave/comp-off/${id}/${d}`), { invalidate: approvalsKeys, success: 'Done' });
export const useDecideGoal = () => useAction(decide((id, d) => `/performance/goals/${id}/${d}`), { invalidate: approvalsKeys, success: 'Done' });
export const useDecideSeparation = () => useAction(decide((id, d) => `/lifecycle/separations/${id}/${d}`), { invalidate: approvalsKeys, success: 'Done' });
export { decided };
