import { downloadFile, get, patch, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { FnfSettlement, Onboarding, OnboardingTemplate, Separation, SeparationType, TaskStatus } from '@/types/lifecycle';

export const lifecycleService = {
  templates: () => get<OnboardingTemplate[]>(E.lifecycle.templates),
  onboardings: (all = false) => get<Onboarding[]>(E.lifecycle.onboarding, { all }),
  onboardingFor: (employeeId: string) => get<Onboarding | null>(E.lifecycle.onboardingFor(employeeId)),
  updateTask: (id: string, status: TaskStatus, remarks?: string) => patch<Onboarding>(E.lifecycle.task(id), { status, remarks }),
  resign: (d: { reason: string; lastWorkingDate?: string }) => post<Separation>(E.lifecycle.resign, d),
  initiate: (d: { employeeId: string; separationType: SeparationType; lastWorkingDate: string; reason?: string }) => post<Separation>(E.lifecycle.separations, d),
  separations: () => get<Separation[]>(E.lifecycle.separations),
  decide: (id: string, a: 'approve' | 'reject', d: { lastWorkingDate?: string; comment?: string }) => post<Separation | { rejected: boolean }>(E.lifecycle.separationAction(id, a), d),
  clearance: (id: string, status: 'PENDING' | 'CLEARED' | 'NOT_APPLICABLE', remarks?: string) => patch(E.lifecycle.clearance(id), { status, remarks }),
  exitInterview: (id: string, notes: string) => post(E.lifecycle.separationAction(id, 'exit-interview'), { notes }),
  computeFnf: (id: string, d: { bonusAmount?: number; otherDeductions?: number }) => post<FnfSettlement>(E.lifecycle.separationAction(id, 'fnf'), d),
  approveFnf: (id: string) => post<Separation>(E.lifecycle.separationAction(id, 'fnf/approve')),
  complete: (id: string) => post<Separation>(E.lifecycle.separationAction(id, 'complete')),
  downloadLetter: (id: string, type: 'relieving' | 'experience') => downloadFile(E.lifecycle.letter(id), { type }, `${type}-letter.pdf`),
};
