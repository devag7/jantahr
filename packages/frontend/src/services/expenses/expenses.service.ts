import { del, get, patch, post, upload } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Ok } from '@/types/common';
import type { ExpenseClaim, ExpenseInput, TravelInput, TravelRequest } from '@/types/expenses';

export const expensesService = {
  categories: () => get<string[]>(E.expenses.categories),
  claims: (scope: 'mine' | 'team' | 'all', status?: string) => get<ExpenseClaim[]>(E.expenses.claims, { scope, status }),
  create: (d: ExpenseInput) => post<ExpenseClaim>(E.expenses.claims, d),
  update: (id: string, d: Partial<ExpenseInput>) => patch<ExpenseClaim>(E.expenses.claim(id), d),
  remove: (id: string) => del<Ok>(E.expenses.claim(id)),
  submit: (id: string) => post<ExpenseClaim>(E.expenses.claimAction(id, 'submit')),
  decide: (id: string, a: 'approve' | 'reject', comment?: string) => post<ExpenseClaim>(E.expenses.claimAction(id, a), { comment }),
  uploadReceipt: (file: File) => { const f = new FormData(); f.append('file', file); return upload<{ receiptUrl: string; name: string }>(E.expenses.receipts, f); },
  travel: (scope: 'mine' | 'team') => get<TravelRequest[]>(E.expenses.travel, { scope }),
  createTravel: (d: TravelInput) => post<TravelRequest>(E.expenses.travel, d),
  decideTravel: (id: string, a: 'approve' | 'reject', comment?: string) => post<TravelRequest>(E.expenses.travelDecision(id, a), { comment }),
};
