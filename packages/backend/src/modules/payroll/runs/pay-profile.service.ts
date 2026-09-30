import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { num } from '../../../common/utils/money';
import { PrismaService } from '../../../prisma/prisma.service';
import { evaluateFormula, FormulaError } from '../engine/formula';
import { currentPfCeiling } from '../engine/config';
import { codeWages, CodeWages, labourCodesApply } from '../engine/labour-code';
import { calcPF } from '../engine/statutory';

export const RESERVED_VARS = ['CTC', 'MONTHLY_CTC', 'VARIABLE', 'TOTAL_DAYS', 'PAYMENT_DAYS', 'ER_PF', 'GRATUITY'];

export type StructureWithComponents = Prisma.SalaryStructureGetPayload<{ include: { components: { include: { component: true } } } }>;
export type AssignmentWithStructure = Prisma.SalaryStructureAssignmentGetPayload<{ include: { salaryStructure: { include: { components: { include: { component: true } } } } } }>;

export interface EvaluatedLine {
  componentId: string;
  abbr: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  amount: number; // full-month amount
  isTaxApplicable: boolean;
  exemptionCode?: string | null;
  dependsOnPaymentDays: boolean;
  isPfApplicable: boolean;
  isEsiApplicable: boolean;
  isPtApplicable: boolean;
  componentType: string | null;
}

export interface EvalContext {
  totalDays: number;
  pfApplicable: boolean;
  /** EPF ceiling for the wage month; defaults to the current month's ceiling. */
  pfCeiling?: number;
}

const STRUCT_INCLUDE = { components: { include: { component: true }, orderBy: { sortOrder: 'asc' as const } } };

@Injectable()
export class PayProfileService {
  constructor(private prisma: PrismaService) {}

  assignmentAt(employeeId: string, date: Date) {
    return this.prisma.salaryStructureAssignment.findFirst({
      where: { employeeId, fromDate: { lte: date } }, orderBy: { fromDate: 'desc' }, include: { salaryStructure: { include: STRUCT_INCLUDE } },
    });
  }

  /** Assignments effective during [start, end]: the one in force at `start` plus any that begin later in the window. */
  async assignmentsForPeriod(employeeId: string, start: Date, end: Date): Promise<AssignmentWithStructure[]> {
    const [atStart, later] = await Promise.all([
      this.assignmentAt(employeeId, start),
      this.prisma.salaryStructureAssignment.findMany({
        where: { employeeId, fromDate: { gt: start, lte: end } }, orderBy: { fromDate: 'asc' }, include: { salaryStructure: { include: STRUCT_INCLUDE } },
      }),
    ]);
    return [...(atStart ? [atStart] : []), ...later];
  }

  /** Evaluate a structure for a CTC into full-month amounts, honouring component order and formulas. */
  evaluate(structure: StructureWithComponents, ctc: number, variable: number, ctx: EvalContext): EvaluatedLine[] {
    const vars: Record<string, number> = {
      CTC: ctc, MONTHLY_CTC: ctc / 12, VARIABLE: variable / 12, TOTAL_DAYS: ctx.totalDays, PAYMENT_DAYS: ctx.totalDays, ER_PF: 0, GRATUITY: 0,
    };
    const lines: EvaluatedLine[] = [];
    let pfWages = 0;
    let basic = 0;

    for (const sc of structure.components) {
      const c = sc.component;
      let amount: number;
      const formula = sc.formula || c.formula;
      if (formula) {
        try {
          amount = evaluateFormula(formula, vars);
        } catch (e) {
          throw new BadRequestException(`Formula error in ${c.name} (${c.abbr}): ${(e as FormulaError).message}`);
        }
      } else amount = num(sc.amount);
      amount = Math.max(0, Math.round(amount));

      vars[c.abbr.toUpperCase()] = amount;
      if (c.type === 'EARNING') {
        if (c.isPfApplicable) pfWages += amount;
        if (c.componentType === 'BASIC') basic = amount;
        vars.ER_PF = ctx.pfApplicable ? calcPF(pfWages, ctx.pfCeiling ?? currentPfCeiling()).employerTotal : 0;
        vars.GRATUITY = Math.round(basic * 0.0481);
      }
      lines.push({
        componentId: c.id, abbr: c.abbr, name: c.name, type: c.type, amount, isTaxApplicable: c.isTaxApplicable, exemptionCode: c.exemptionCode, dependsOnPaymentDays: c.dependsOnPaymentDays,
        isPfApplicable: c.isPfApplicable, isEsiApplicable: c.isEsiApplicable, isPtApplicable: c.isPtApplicable, componentType: c.componentType,
      });
    }
    return lines;
  }

  /** Monthly Basic + DA for an employee (used for leave encashment / gratuity). */
  async getBasicDaMonthly(employeeId: string, date: Date): Promise<number> {
    const a = await this.assignmentAt(employeeId, date);
    if (!a) return 0;
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { pfApplicable: true } });
    const lines = this.evaluate(a.salaryStructure, num(a.base), num(a.variable), { totalDays: 30, pfApplicable: emp.pfApplicable });
    return lines.filter((l) => l.type === 'EARNING' && (l.componentType === 'BASIC' || l.componentType === 'DA')).reduce((s, l) => s + l.amount, 0);
  }

  /**
   * Wage base for gratuity, leave encashment and F&F at a date: Basic + DA, topped up to 50% of remuneration under the labour codes
   * (only for dates on/after 21-Nov-2025 and when the company has the rule switched on).
   */
  async getCodeWagesMonthly(employeeId: string, date: Date, companyId: string): Promise<CodeWages> {
    const [basicDa, gross, company] = await Promise.all([
      this.getBasicDaMonthly(employeeId, date), this.getGrossMonthly(employeeId, date),
      this.prisma.company.findUnique({ where: { id: companyId }, select: { labourCodeWages: true } }),
    ]);
    return company?.labourCodeWages && labourCodesApply(date) ? codeWages(basicDa, gross) : { basicDa, remuneration: gross, topUp: 0, wages: basicDa };
  }

  /** Monthly fixed gross (all structure earnings) at a date. */
  async getGrossMonthly(employeeId: string, date: Date): Promise<number> {
    const a = await this.assignmentAt(employeeId, date);
    if (!a) return 0;
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { pfApplicable: true } });
    return this.evaluate(a.salaryStructure, num(a.base), num(a.variable), { totalDays: 30, pfApplicable: emp.pfApplicable })
      .filter((l) => l.type === 'EARNING').reduce((s, l) => s + l.amount, 0);
  }
}
