'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { lifecycleService } from '@/services/lifecycle/lifecycle.service';
import type { TaskStatus } from '@/types/lifecycle';

const LC = [['lifecycle'], ['employees'], ['reports']] as const;
export const useOnboardings = (all = false) => useQuery({ queryKey: ['lifecycle', 'onboarding', all], queryFn: () => lifecycleService.onboardings(all) });
export const useMyOnboarding = (employeeId?: string) => useQuery({ queryKey: ['lifecycle', 'onboarding-for', employeeId], queryFn: () => lifecycleService.onboardingFor(employeeId!), enabled: !!employeeId });
export const useSeparations = () => useQuery({ queryKey: ['lifecycle', 'separations'], queryFn: lifecycleService.separations });
export const useUpdateTask = () => useApiMutation((v: { id: string; status: TaskStatus }) => lifecycleService.updateTask(v.id, v.status), { invalidate: [...LC] });
export const useResign = () => useApiMutation(lifecycleService.resign, { invalidate: [...LC], success: 'Resignation submitted' });
export const useInitiateSeparation = () => useApiMutation(lifecycleService.initiate, { invalidate: [...LC], success: 'Separation initiated' });
export const useDecideSeparation = () => useApiMutation((v: { id: string; action: 'approve' | 'reject'; lastWorkingDate?: string; comment?: string }) => lifecycleService.decide(v.id, v.action, v), { invalidate: [...LC], success: 'Updated' });
export const useClearance = () => useApiMutation((v: { id: string; status: 'PENDING' | 'CLEARED' | 'NOT_APPLICABLE' }) => lifecycleService.clearance(v.id, v.status), { invalidate: [...LC] });
export const useExitInterview = () => useApiMutation((v: { id: string; notes: string }) => lifecycleService.exitInterview(v.id, v.notes), { invalidate: [...LC], success: 'Exit interview recorded' });
export const useComputeFnf = () => useApiMutation((v: { id: string; bonusAmount?: number; otherDeductions?: number }) => lifecycleService.computeFnf(v.id, v), { invalidate: [...LC], success: 'F&F computed' });
export const useApproveFnf = () => useApiMutation(lifecycleService.approveFnf, { invalidate: [...LC], success: 'F&F approved' });
export const useCompleteSeparation = () => useApiMutation(lifecycleService.complete, { invalidate: [...LC], success: 'Separation completed: access deactivated' });
