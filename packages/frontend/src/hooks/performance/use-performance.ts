'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { performanceService } from '@/services/performance/performance.service';
import type { Goal } from '@/types/performance';

const PF = [['performance']] as const;
export const useCycles = () => useQuery({ queryKey: ['performance', 'cycles'], queryFn: performanceService.cycles });
export const useCycleSummary = (id?: string) => useQuery({ queryKey: ['performance', 'summary', id], queryFn: () => performanceService.summary(id!), enabled: !!id });
export const useGoals = (employeeId?: string) => useQuery({ queryKey: ['performance', 'goals', employeeId], queryFn: () => performanceService.goals(employeeId) });
export const useMyAppraisals = () => useQuery({ queryKey: ['performance', 'mine'], queryFn: performanceService.mine });
export const usePendingAppraisals = () => useQuery({ queryKey: ['performance', 'pending'], queryFn: performanceService.pending });
export const useCycleAppraisals = (id?: string) => useQuery({ queryKey: ['performance', 'by-cycle', id], queryFn: () => performanceService.byCycle(id!), enabled: !!id });
export const useAppraisal = (id?: string) => useQuery({ queryKey: ['performance', 'appraisal', id], queryFn: () => performanceService.appraisal(id!), enabled: !!id });

export const useCreateCycle = () => useApiMutation(performanceService.createCycle, { invalidate: [...PF], success: 'Cycle created' });
export const useLaunchCycle = () => useApiMutation((v: { id: string; departmentId?: string }) => performanceService.launch(v.id, v.departmentId), { invalidate: [...PF], success: (r) => `${r.launched} appraisal(s) launched` });
export const useCreateGoal = () => useApiMutation(performanceService.createGoal, { invalidate: [...PF], success: 'Goal added' });
export const useUpdateGoal = () => useApiMutation((v: { id: string; data: Partial<Goal> }) => performanceService.updateGoal(v.id, v.data), { invalidate: [...PF], success: 'Goal updated' });
export const useDecideGoal = () => useApiMutation((v: { id: string; action: 'approve' | 'reject' }) => performanceService.decideGoal(v.id, v.action), { invalidate: [...PF] });
export const useSelfReview = () => useApiMutation((v: { id: string; selfRating: number; selfComment: string }) => performanceService.selfReview(v.id, v), { invalidate: [...PF], success: 'Self review submitted' });
export const useManagerReview = () => useApiMutation((v: { id: string; managerRating: number; managerComment: string; promotionRecommended?: boolean }) => performanceService.managerReview(v.id, v), { invalidate: [...PF], success: 'Review submitted' });
export const useFinalize = () => useApiMutation((v: { id: string; finalRating: number; hrComment?: string; promotionRecommended?: boolean; salaryRevisionPercent?: number }) => performanceService.finalize(v.id, v), { invalidate: [...PF], success: 'Appraisal finalised' });
export const useApplyRevision = () => useApiMutation((v: { id: string; effectiveFrom: string }) => performanceService.applyRevision(v.id, v.effectiveFrom), { invalidate: [['payroll'], ['employees']], success: (r) => `CTC revised from ₹${r.previousCtc.toLocaleString('en-IN')} to ₹${r.newCtc.toLocaleString('en-IN')}` });
