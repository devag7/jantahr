'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { payrollService } from '@/services/payroll/payroll.service';
import type { SalaryComponent } from '@/types/payroll';

const PAY = [['payroll'], ['reports']] as const;

export const useComponents = () => useQuery({ queryKey: ['payroll', 'components'], queryFn: payrollService.components });
export const useStructures = () => useQuery({ queryKey: ['payroll', 'structures'], queryFn: payrollService.structures });
export const useAssignments = (employeeId?: string) => useQuery({ queryKey: ['payroll', 'assignments', employeeId], queryFn: () => payrollService.assignments(employeeId) });
export const useAdditional = () => useQuery({ queryKey: ['payroll', 'additional'], queryFn: payrollService.additional });
export const useLoans = () => useQuery({ queryKey: ['payroll', 'loans'], queryFn: payrollService.loans });
export const useRuns = () => useQuery({ queryKey: ['payroll', 'runs'], queryFn: payrollService.runs });
export const useRun = (id: string) => useQuery({ queryKey: ['payroll', 'run', id], queryFn: () => payrollService.run(id), enabled: !!id });
export const useEmployeeSlips = (employeeId: string) => useQuery({ queryKey: ['payroll', 'employee-slips', employeeId], queryFn: () => payrollService.employeeSlips(employeeId), enabled: !!employeeId });
export const useMySlips = () => useQuery({ queryKey: ['payroll', 'my-slips'], queryFn: payrollService.mySlips });
export const useTaxCategories = () => useQuery({ queryKey: ['payroll', 'tax-categories'], queryFn: payrollService.taxCategories, staleTime: Infinity });
export const useMyDeclaration = (fy?: number) => useQuery({ queryKey: ['payroll', 'declaration', fy], queryFn: () => payrollService.myDeclaration(fy) });
export const useTaxComparison = (fy?: number) => useQuery({ queryKey: ['payroll', 'tax-compare', fy], queryFn: () => payrollService.compareRegimes(fy), retry: false });
export const useDeclarations = (status?: string) => useQuery({ queryKey: ['payroll', 'declarations', status], queryFn: () => payrollService.declarations(status) });

export const usePreviewStructure = () => useApiMutation(payrollService.previewStructure, { silentError: true });
export const useCreateComponent = () => useApiMutation((d: Partial<SalaryComponent>) => payrollService.createComponent(d), { invalidate: [['payroll', 'components']], success: 'Component created' });
export const useDeleteComponent = () => useApiMutation(payrollService.deleteComponent, { invalidate: [['payroll', 'components']], success: 'Component deleted' });
export const useCreateStructure = () => useApiMutation(payrollService.createStructure, { invalidate: [['payroll', 'structures']], success: 'Salary structure saved' });
export const useDeleteStructure = () => useApiMutation(payrollService.deleteStructure, { invalidate: [['payroll', 'structures']], success: 'Structure deleted' });
export const useAssign = () => useApiMutation(payrollService.assign, { invalidate: [['payroll', 'assignments'], ['employees']], success: 'Salary assigned' });
export const useBulkAssign = () => useApiMutation(payrollService.bulkAssign, { invalidate: [['payroll', 'assignments'], ['employees']] });
export const useCreateAdditional = () => useApiMutation(payrollService.createAdditional, { invalidate: [['payroll', 'additional']], success: 'Entry added: it will be picked up in that month’s payroll' });
export const useDeleteAdditional = () => useApiMutation(payrollService.deleteAdditional, { invalidate: [['payroll', 'additional']], success: 'Entry removed' });
export const useCreateLoan = () => useApiMutation(payrollService.createLoan, { invalidate: [['payroll', 'loans']], success: 'Loan recorded' });
export const useCloseLoan = () => useApiMutation(payrollService.closeLoan, { invalidate: [['payroll', 'loans']], success: 'Loan closed' });
export const useCreateRun = () => useApiMutation(payrollService.createRun, { invalidate: [...PAY] });
export const useRunAction = () => useApiMutation((v: { id: string; action: 'generate' | 'approve' | 'paid' | 'reopen'; treatUnmarkedAsLop?: boolean }) => payrollService.runAction(v.id, v.action, { treatUnmarkedAsLop: v.treatUnmarkedAsLop }), { invalidate: [...PAY, ['leave'], ['attendance']] });
export const useDeleteRun = () => useApiMutation(payrollService.deleteRun, { invalidate: [...PAY], success: 'Payroll run deleted' });
export const useSaveDeclaration = () => useApiMutation(payrollService.saveDeclaration, { invalidate: [['payroll', 'declaration'], ['payroll', 'tax-compare']] });
export const useDecideDeclaration = () => useApiMutation((v: { id: string; action: 'approve' | 'reject' }) => payrollService.decideDeclaration(v.id, v.action), { invalidate: [['payroll', 'declarations']], success: 'Declaration updated' });
