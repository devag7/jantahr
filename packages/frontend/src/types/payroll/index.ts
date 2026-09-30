export type PayrollStatus = 'DRAFT' | 'GENERATED' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type TaxRegime = 'OLD' | 'NEW';
export interface SalaryComponent { id: string; name: string; abbr: string; type: 'EARNING' | 'DEDUCTION'; isStatutory: boolean; isTaxApplicable: boolean; dependsOnPaymentDays: boolean; isPfApplicable: boolean; isEsiApplicable: boolean; isPtApplicable: boolean; componentType: string | null; formula: string | null; exemptionCode?: 'CHILD_EDUCATION' | 'HOSTEL' | 'MEAL' | null }
export interface StructureComponent { id: string; componentId: string; formula: string | null; amount: number | null; sortOrder: number; component: { id: string; name: string; abbr: string; type: 'EARNING' | 'DEDUCTION' } }
export interface SalaryStructure { id: string; name: string; description: string | null; isActive: boolean; components: StructureComponent[]; _count: { assignments: number } }
export interface StructureInput { name: string; description?: string; isActive?: boolean; components: { componentId: string; formula?: string; amount?: number }[] }
export interface StructurePreview {
  monthly: { name: string; abbr: string; monthly: number; annual: number }[]; grossMonthly: number; grossAnnual: number;
  employer: { pf: number; edli: number; admin: number; esi: number; gratuity: number }; employee: { pf: number; esi: number }; ctcMonthly: number;
}
export interface Assignment { id: string; employeeId: string; fromDate: string; base: number; variable: number | null; taxRegime: TaxRegime; employee: { employeeCode: string; firstName: string; lastName: string }; salaryStructure: { name: string } }
export interface AssignmentInput { employeeId: string; salaryStructureId: string; fromDate: string; base: number; taxRegime?: TaxRegime; variable?: number }
export interface AdditionalSalary { id: string; amount: number; payrollDate: string; reason: string | null; type: 'EARNING' | 'DEDUCTION'; isRecurring: boolean; employee: { employeeCode: string; firstName: string; lastName: string }; salaryComponent: { name: string; abbr: string } }
export interface AdditionalInput { employeeId: string; salaryComponentId: string; amount: number; payrollDate: string; reason?: string; isRecurring?: boolean; fromDate?: string; toDate?: string }
export interface Loan { id: string; loanType: 'LOAN' | 'ADVANCE'; principal: number; emi: number; totalInstallments: number; paidInstallments: number; outstanding: number; startDate: string; status: 'ACTIVE' | 'CLOSED' | 'CANCELLED'; reason: string | null; employee: { employeeCode: string; firstName: string; lastName: string } }
export interface LoanInput { employeeId: string; loanType?: 'LOAN' | 'ADVANCE'; principal: number; totalInstallments: number; startDate: string; reason?: string }
export interface SlipLine { name: string; abbr: string; amount: number }
export interface Slip {
  id: string; employeeId: string; employee?: { id: string; employeeCode: string; name: string; department?: string; designation?: string }; month: number; year: number; status: PayrollStatus;
  totalWorkingDays: number; paymentDays: number; absentDays: number; leaveWithoutPay: number; grossPay: number; totalDeductions: number; netPay: number; roundedTotal: number; taxRegime: TaxRegime;
  pfEmployee: number; esiEmployee: number; professionalTax: number; tds: number; loanDeduction: number; employerContribution: number; remarks: string | null; paidAt: string | null; earnings: SlipLine[]; deductions: SlipLine[];
}
export interface PayrollRun { id: string; month: number; year: number; status: PayrollStatus; employeeCount: number; totalGross: number | null; totalDeductions: number | null; totalNet: number | null; totalEmployerContribution: number | null; treatUnmarkedAsLop: boolean; processedAt: string | null }
export interface PayrollRunDetail extends PayrollRun { slips: Slip[] }
export interface RunResult { run: PayrollRun; generated: number; skipped: { employeeId: string; employeeCode: string; name: string; reason: string }[] }
export interface TaxSubCategory { id: string; code: string; name: string; maxAmount: number }
export interface TaxCategory { id: string; section: string; name: string; maxAmount: number; subCategories: TaxSubCategory[] }
export interface Declaration {
  id: string; taxRegime: TaxRegime; monthlyRent: number; rentedInMetro: boolean; childrenCount?: number; homeLoanInterest: number; totalDeclaredAmount: number; isSubmitted: boolean; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  details: { subCategoryId: string; declaredAmount: number; subCategory: TaxSubCategory }[];
  employee?: { employeeCode: string; firstName: string; lastName: string };
}
export interface DeclarationInput { fyStartYear?: number; taxRegime: TaxRegime; monthlyRent?: number; rentedInMetro?: boolean; childrenCount?: number; homeLoanInterest?: number; details: { subCategoryId: string; declaredAmount: number }[]; submit?: boolean }
export interface TaxResult { regime: TaxRegime; grossIncome: number; totalDeductions: number; taxableIncome: number; taxOnIncome: number; rebate: number; surcharge: number; cess: number; totalTax: number; effectiveRate: number; deductionBreakup: Record<string, number> }
export interface TaxComparison { fyStartYear: number; annualTaxableSalary: number; old: TaxResult; new: TaxResult; recommended: TaxRegime; saving: number; assumptions: string[] }
export type StatutoryReport = 'ecr' | 'esi' | 'pt' | 'bank-advice' | 'register' | '24q' | 'bonus';
