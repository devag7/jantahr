import { get, patch, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Appraisal, AppraisalCycle, AppraisalDetail, CycleSummary, Goal, GoalInput } from '@/types/performance';

export const performanceService = {
  cycles: () => get<AppraisalCycle[]>(E.performance.cycles),
  createCycle: (d: { name: string; startDate: string; endDate: string }) => post<AppraisalCycle>(E.performance.cycles, d),
  launch: (id: string, departmentId?: string) => post<{ launched: number; alreadyExisting: number }>(E.performance.launch(id), { departmentId }),
  summary: (id: string) => get<CycleSummary>(E.performance.summary(id)),
  goals: (employeeId?: string) => get<Goal[]>(E.performance.goals, { employeeId }),
  createGoal: (d: GoalInput) => post<Goal>(E.performance.goals, d),
  updateGoal: (id: string, d: Partial<Goal>) => patch<Goal>(E.performance.goal(id), d),
  decideGoal: (id: string, a: 'approve' | 'reject') => post<Goal>(E.performance.goalDecision(id, a)),
  mine: () => get<Appraisal[]>(E.performance.mine),
  pending: () => get<Appraisal[]>(E.performance.pending),
  byCycle: (id: string) => get<Appraisal[]>(E.performance.byCycle(id)),
  appraisal: (id: string) => get<AppraisalDetail>(E.performance.appraisal(id)),
  selfReview: (id: string, d: { selfRating: number; selfComment: string }) => post<Appraisal>(E.performance.appraisalAction(id, 'self-review'), d),
  managerReview: (id: string, d: { managerRating: number; managerComment: string; promotionRecommended?: boolean }) => post<Appraisal>(E.performance.appraisalAction(id, 'manager-review'), d),
  finalize: (id: string, d: { finalRating: number; hrComment?: string; promotionRecommended?: boolean; salaryRevisionPercent?: number }) => post<Appraisal>(E.performance.appraisalAction(id, 'finalize'), d),
  applyRevision: (id: string, effectiveFrom: string) => post<{ previousCtc: number; newCtc: number }>(E.performance.appraisalAction(id, 'apply-revision'), { effectiveFrom }),
};
