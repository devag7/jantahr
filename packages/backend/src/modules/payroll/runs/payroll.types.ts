import { Prisma, TaxRegime } from '@prisma/client';

/** One month's pay for one employee, as computed before it is stored as a salary slip. */
export interface SlipLine { componentId: string; abbr: string; name: string; amount: number }

export interface SlipComputation {
  employeeId: string;
  companyId: string;
  month: number;
  year: number;
  start: Date;
  end: Date;
  totalDays: number;
  totalWorkingDays: number;
  paymentDays: number;
  absentDays: number;
  lopDays: number;
  earnings: SlipLine[];
  deductions: SlipLine[];
  grossPay: number;
  taxableEarnings: number;
  totalDeductions: number;
  netPay: number;
  taxRegime: TaxRegime;
  pfWages: number;
  pfEmployee: number;
  pfEmployerEpf: number;
  pfEmployerEps: number;
  pfEdli: number;
  pfAdmin: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  lwfEmployee: number;
  lwfEmployer: number;
  tds: number;
  loanDeduction: number;
  gratuityProvision: number;
  warnings: string[];
  taxProjection?: Record<string, number>;
}

export interface SlipResult { ok: boolean; slip?: SlipComputation; reason?: string }

/** Relations loaded with a salary slip for display (lines with component names, employee summary). */
export const SLIP_INCLUDE = {
  earnings: { include: { salaryComponent: { select: { name: true, abbr: true } } } },
  deductions: { include: { salaryComponent: { select: { name: true, abbr: true } } } },
  employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
} satisfies Prisma.SalarySlipInclude;

/** A salary slip with its lines; `employee` is absent when the caller already knows whose slip it is. */
export type SlipWithLines = Omit<Prisma.SalarySlipGetPayload<{ include: typeof SLIP_INCLUDE }>, 'employee'> & {
  employee?: Prisma.SalarySlipGetPayload<{ include: typeof SLIP_INCLUDE }>['employee'] | null;
};
