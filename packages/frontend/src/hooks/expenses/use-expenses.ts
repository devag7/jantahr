'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { expensesService } from '@/services/expenses/expenses.service';

const EX = [['expenses'], ['reports']] as const;
export const useExpenseCategories = () => useQuery({ queryKey: ['expenses', 'categories'], queryFn: expensesService.categories, staleTime: Infinity });
export const useClaims = (scope: 'mine' | 'team' | 'all', status?: string) => useQuery({ queryKey: ['expenses', 'claims', scope, status], queryFn: () => expensesService.claims(scope, status) });
export const useTravel = (scope: 'mine' | 'team') => useQuery({ queryKey: ['expenses', 'travel', scope], queryFn: () => expensesService.travel(scope) });

export const useCreateClaim = () => useApiMutation(expensesService.create, { invalidate: [...EX], success: 'Claim saved' });
export const useSubmitClaim = () => useApiMutation(expensesService.submit, { invalidate: [...EX], success: 'Claim submitted for approval' });
export const useDeleteClaim = () => useApiMutation(expensesService.remove, { invalidate: [...EX], success: 'Claim deleted' });
export const useDecideClaim = () => useApiMutation((v: { id: string; action: 'approve' | 'reject'; comment?: string }) => expensesService.decide(v.id, v.action, v.comment), { invalidate: [...EX], success: 'Claim updated' });
export const useUploadReceipt = () => useApiMutation((f: File) => expensesService.uploadReceipt(f));
export const useCreateTravel = () => useApiMutation(expensesService.createTravel, { invalidate: [...EX], success: 'Travel request submitted' });
export const useDecideTravel = () => useApiMutation((v: { id: string; action: 'approve' | 'reject' }) => expensesService.decideTravel(v.id, v.action), { invalidate: [...EX], success: 'Travel request updated' });
