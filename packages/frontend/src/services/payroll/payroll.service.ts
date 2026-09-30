import { del, downloadFile, get, post, put } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Ok } from '@/types/common';
import type {
  AdditionalInput, AdditionalSalary, Assignment, AssignmentInput, Declaration, DeclarationInput, Loan, LoanInput, PayrollRun, PayrollRunDetail, RunResult, SalaryComponent, SalaryStructure, Slip,
  StatutoryReport, StructureInput, StructurePreview, TaxCategory, TaxComparison,
} from '@/types/payroll';

export const payrollService = {
  components: () => get<SalaryComponent[]>(E.payroll.components),
  createComponent: (d: Partial<SalaryComponent>) => post<SalaryComponent>(E.payroll.components, d),
  deleteComponent: (id: string) => del<Ok>(E.payroll.component(id)),
  structures: () => get<SalaryStructure[]>(E.payroll.structures),
  createStructure: (d: StructureInput) => post<SalaryStructure>(E.payroll.structures, d),
  deleteStructure: (id: string) => del<Ok>(E.payroll.structure(id)),
  previewStructure: (d: { salaryStructureId: string; ctc: number; employeeId?: string }) => post<StructurePreview>(E.payroll.structurePreview, d),
  assignments: (employeeId?: string) => get<Assignment[]>(E.payroll.assignments, { employeeId }),
  assign: (d: AssignmentInput) => post<Assignment>(E.payroll.assignments, d),
  bulkAssign: (d: { employeeIds: string[]; salaryStructureId: string; fromDate: string }) => post<{ assigned: number; failed: { employeeId: string; reason: string }[] }>(E.payroll.assignmentsBulk, d),
  additional: () => get<AdditionalSalary[]>(E.payroll.additional),
  createAdditional: (d: AdditionalInput) => post<AdditionalSalary>(E.payroll.additional, d),
  deleteAdditional: (id: string) => del<Ok>(E.payroll.additionalOne(id)),
  loans: () => get<Loan[]>(E.payroll.loans),
  createLoan: (d: LoanInput) => post<Loan>(E.payroll.loans, d),
  closeLoan: (id: string) => post<Loan>(E.payroll.loanClose(id)),
  runs: () => get<PayrollRun[]>(E.payroll.runs),
  run: (id: string) => get<PayrollRunDetail>(E.payroll.run(id)),
  createRun: (d: { month: number; year: number; treatUnmarkedAsLop?: boolean }) => post<RunResult>(E.payroll.runs, d),
  runAction: (id: string, a: 'generate' | 'approve' | 'paid' | 'reopen', body?: { treatUnmarkedAsLop?: boolean }) => post<PayrollRun | RunResult>(E.payroll.runAction(id, a), body),
  deleteRun: (id: string) => del<Ok>(E.payroll.run(id)),
  mySlips: () => get<Slip[]>(E.payroll.mySlips),
  employeeSlips: (id: string) => get<Slip[]>(E.payroll.employeeSlips(id)),
  slip: (id: string) => get<Slip>(E.payroll.slip(id)),
  downloadSlip: (id: string, name: string) => downloadFile(E.payroll.slipPdf(id), undefined, name),
  taxCategories: () => get<TaxCategory[]>(E.payroll.taxCategories),
  myDeclaration: (fy?: number) => get<{ fyStartYear: number; declaration: Declaration | null }>(E.payroll.myDeclaration, { fy }),
  saveDeclaration: (d: DeclarationInput) => put<Declaration>(E.payroll.myDeclaration, d),
  compareRegimes: (fy?: number) => get<TaxComparison>(E.payroll.taxCompare, { fy }),
  declarations: (status?: string) => get<Declaration[]>(E.payroll.declarations, { status }),
  decideDeclaration: (id: string, a: 'approve' | 'reject') => post<Declaration>(E.payroll.declarationDecision(id, a)),
  downloadForm16: (fy: number, employeeId?: string) => downloadFile(E.payroll.form16, { fy, employeeId }, 'TaxStatement.pdf'),
  reportJson: <T>(name: StatutoryReport, params: object) => get<T>(E.payroll.report(name), { ...params, format: 'json' }),
  downloadReport: (name: StatutoryReport, params: object, fallback: string) => downloadFile(E.payroll.report(name), params, fallback),
};
