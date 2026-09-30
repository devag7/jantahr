import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Gender, Prisma, SalaryComponentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toDateOnly } from '../../common/utils/dates';
import { errorMessage } from '../../common/utils/errors';
import {
  DEFAULT_HOLIDAYS, LWF_RATES, PT_HALF_YEARLY, PT_REPEALED_ON, NEW_REGIME_SLABS_FY2025, OLD_REGIME_SLABS, PT_SLABS, TAX_EXEMPTION_CATEGORIES,
} from './master-data';

type Tx = Prisma.TransactionClient;

interface ComponentSeed {
  name: string; abbr: string; type: SalaryComponentType; componentType: string;
  isTaxApplicable?: boolean; dependsOnPaymentDays?: boolean; isStatutory?: boolean; isPfApplicable?: boolean;
  isEsiApplicable?: boolean; isPtApplicable?: boolean; sortOrder: number; exemptionCode?: string;
}

export const COMPONENT_SEEDS: ComponentSeed[] = [
  { name: 'Basic Salary', abbr: 'BASIC', type: 'EARNING', componentType: 'BASIC', isPfApplicable: true, sortOrder: 1 },
  { name: 'House Rent Allowance', abbr: 'HRA', type: 'EARNING', componentType: 'HRA', sortOrder: 2 },
  { name: 'Special Allowance', abbr: 'SPL', type: 'EARNING', componentType: 'ALLOWANCE', sortOrder: 3 },
  { name: 'Dearness Allowance', abbr: 'DA', type: 'EARNING', componentType: 'DA', isPfApplicable: true, sortOrder: 4 },
  { name: 'Conveyance Allowance', abbr: 'CONV', type: 'EARNING', componentType: 'ALLOWANCE', sortOrder: 5 },
  { name: 'Medical Allowance', abbr: 'MED', type: 'EARNING', componentType: 'ALLOWANCE', sortOrder: 6 },
  { name: 'Leave Travel Allowance', abbr: 'LTA', type: 'EARNING', componentType: 'ALLOWANCE', sortOrder: 7 },
  { name: "Children's Education Allowance", abbr: 'CEA', type: 'EARNING', componentType: 'ALLOWANCE', exemptionCode: 'CHILD_EDUCATION', sortOrder: 8 },
  { name: 'Hostel Allowance', abbr: 'HOSTEL', type: 'EARNING', componentType: 'ALLOWANCE', exemptionCode: 'HOSTEL', sortOrder: 9 },
  { name: 'Meal Vouchers', abbr: 'MEAL', type: 'EARNING', componentType: 'ALLOWANCE', exemptionCode: 'MEAL', isEsiApplicable: false, sortOrder: 10 },
  { name: 'Performance Bonus', abbr: 'BONUS', type: 'EARNING', componentType: 'ADDITIONAL', dependsOnPaymentDays: false, isEsiApplicable: false, sortOrder: 20 },
  { name: 'Incentive', abbr: 'INCENTIVE', type: 'EARNING', componentType: 'ADDITIONAL', dependsOnPaymentDays: false, sortOrder: 21 },
  { name: 'Arrears', abbr: 'ARREARS', type: 'EARNING', componentType: 'ADDITIONAL', dependsOnPaymentDays: false, sortOrder: 22 },
  { name: 'Leave Encashment', abbr: 'LEAVEENC', type: 'EARNING', componentType: 'ADDITIONAL', dependsOnPaymentDays: false, isEsiApplicable: false, sortOrder: 23 },
  { name: 'Expense Reimbursement', abbr: 'REIMB', type: 'EARNING', componentType: 'REIMBURSEMENT', isTaxApplicable: false, dependsOnPaymentDays: false, isEsiApplicable: false, isPtApplicable: false, sortOrder: 24 },
  { name: 'Provident Fund (Employee)', abbr: 'PF', type: 'DEDUCTION', componentType: 'PF', isStatutory: true, sortOrder: 50 },
  { name: 'Employee State Insurance', abbr: 'ESI', type: 'DEDUCTION', componentType: 'ESI', isStatutory: true, sortOrder: 51 },
  { name: 'Professional Tax', abbr: 'PT', type: 'DEDUCTION', componentType: 'PT', isStatutory: true, sortOrder: 52 },
  { name: 'Labour Welfare Fund', abbr: 'LWF', type: 'DEDUCTION', componentType: 'LWF', isStatutory: true, sortOrder: 53 },
  { name: 'Income Tax (TDS)', abbr: 'TDS', type: 'DEDUCTION', componentType: 'TDS', isStatutory: true, sortOrder: 54 },
  { name: 'Loan / Advance Recovery', abbr: 'LOAN', type: 'DEDUCTION', componentType: 'LOAN', sortOrder: 55 },
  { name: 'Other Recovery', abbr: 'RECOVERY', type: 'DEDUCTION', componentType: 'ADDITIONAL', dependsOnPaymentDays: false, sortOrder: 56 },
];

/**
 * Formula variables available in structures: CTC (annual), MONTHLY_CTC, TOTAL_DAYS, PAYMENT_DAYS, ER_PF (employer PF/month),
 * GRATUITY (4.81% of Basic/month), plus any earlier component by abbreviation.
 */
export const DEFAULT_STRUCTURE = [
  // Labour codes (21-Nov-2025): Basic + DA must be at least 50% of remuneration, or the shortfall counts as wages anyway
  { abbr: 'BASIC', formula: 'MONTHLY_CTC * 0.50' },
  { abbr: 'HRA', formula: 'BASIC * 0.40' },
  { abbr: 'SPL', formula: 'MAX(0, MONTHLY_CTC - BASIC - HRA - ER_PF - GRATUITY)' },
];

const LEAVE_TYPE_SEEDS: {
  name: string; days: number | null; data: Partial<Prisma.LeaveTypeUncheckedCreateInput>;
}[] = [
  { name: 'Casual Leave', days: 12, data: { maxDaysAllowed: 12, sandwichRule: true } },
  { name: 'Privilege Leave', days: 15, data: { maxDaysAllowed: 30, isEarnedLeave: true, earnedLeaveFrequency: 'MONTHLY', isCarryForward: true, maxCarryForwardDays: 30, isEncashable: true, maxEncashableDays: 30 } /* OSH Code s.32: carry-forward capped at 30 days */ },
  { name: 'Sick Leave', days: 12, data: { maxDaysAllowed: 36, isCarryForward: true, maxCarryForwardDays: 24 } },
  { name: 'Maternity Leave', days: 182, data: { maxDaysAllowed: 182, applicableGender: Gender.FEMALE, includeHolidays: true } },
  { name: 'Paternity Leave', days: 15, data: { maxDaysAllowed: 15, applicableGender: Gender.MALE, includeHolidays: true } },
  { name: 'Bereavement Leave', days: 5, data: { maxDaysAllowed: 5 } },
  { name: 'Compensatory Off', days: null, data: { isCompensatory: true } },
  { name: 'Leave Without Pay', days: null, data: { isLWP: true, isPaid: false, allowNegativeBalance: true, includeHolidays: false } },
];

@Injectable()
export class CompanySetupService implements OnModuleInit {
  private readonly logger = new Logger(CompanySetupService.name);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureGlobalMasterData();
    } catch (e) {
      this.logger.error(`Master data bootstrap failed: ${errorMessage(e)}`);
    }
  }

  /** Idempotent: only inserts what is missing. */
  async ensureGlobalMasterData() {
    const p = this.prisma;
    if ((await p.taxExemptionCategory.count()) === 0) {
      for (const c of TAX_EXEMPTION_CATEGORIES) {
        await p.taxExemptionCategory.create({
          data: { section: c.section, name: c.name, maxAmount: c.maxAmount, subCategories: { create: c.subs } },
        });
      }
    }
    if ((await p.incomeTaxSlab.count()) === 0) {
      const effectiveFrom = toDateOnly('2025-04-01');
      await p.incomeTaxSlab.create({
        data: {
          name: 'New Regime FY 2025-26', taxRegime: 'NEW', effectiveFrom, standardDeduction: 75000, taxReliefLimit: 1200000, marginalReliefLimit: 1200000,
          cessPercent: 0.04, slabs: { create: NEW_REGIME_SLABS_FY2025.map((s) => ({ fromAmount: s.from, toAmount: s.to, taxPercent: s.rate })) },
        },
      });
      await p.incomeTaxSlab.create({
        data: {
          name: 'Old Regime FY 2025-26', taxRegime: 'OLD', effectiveFrom, standardDeduction: 50000, taxReliefLimit: 500000, marginalReliefLimit: 500000,
          cessPercent: 0.04, slabs: { create: OLD_REGIME_SLABS.map((s) => ({ fromAmount: s.from, toAmount: s.to, taxPercent: s.rate })) },
        },
      });
    }
    if ((await p.professionalTaxSlab.count()) === 0) {
      const effectiveFrom = toDateOnly('2025-04-01');
      const rows = Object.entries(PT_SLABS).flatMap(([state, slabs]) =>
        slabs.map((s) => ({ state, fromSalary: s.from, toSalary: s.to, taxAmount: s.amount, februaryAmount: s.feb ?? null, gender: s.gender ?? null, effectiveFrom, effectiveTo: PT_REPEALED_ON[state] ? toDateOnly(PT_REPEALED_ON[state]) : null, frequency: PT_HALF_YEARLY[state] ? 'HALF_YEARLY' : 'MONTHLY', deductionMonths: PT_HALF_YEARLY[state] ?? null })),
      );
      await p.professionalTaxSlab.createMany({ data: rows });
    }
    if ((await p.lwfRate.count()) === 0) {
      await p.lwfRate.createMany({ data: LWF_RATES.map((r) => ({ ...r, effectiveFrom: toDateOnly('2025-04-01') })) });
    }
  }

  /** Creates default leave types/policy, salary components/structure, shift and holiday list for a new company. */
  async bootstrapCompany(tx: Tx, companyId: string) {
    // leave types + policy
    const leaveTypes: Record<string, string> = {};
    for (const s of LEAVE_TYPE_SEEDS) {
      const lt = await tx.leaveType.create({ data: { name: s.name, companyId, ...s.data } });
      leaveTypes[s.name] = lt.id;
    }
    await tx.leavePolicy.create({
      data: {
        name: 'Standard Leave Policy', companyId,
        details: { create: LEAVE_TYPE_SEEDS.filter((s) => s.days).map((s) => ({ leaveTypeId: leaveTypes[s.name], annualAllocation: s.days! })) },
      },
    });

    // salary components + default structure
    const comps: Record<string, string> = {};
    for (const c of COMPONENT_SEEDS) {
      const row = await tx.salaryComponent.create({
        data: {
          companyId, name: c.name, abbr: c.abbr, type: c.type, componentType: c.componentType,
          isTaxApplicable: c.isTaxApplicable ?? true, dependsOnPaymentDays: c.dependsOnPaymentDays ?? c.type === 'EARNING',
          isStatutory: c.isStatutory ?? false, isPfApplicable: c.isPfApplicable ?? false,
          isEsiApplicable: c.isEsiApplicable ?? true, isPtApplicable: c.isPtApplicable ?? true, sortOrder: c.sortOrder, exemptionCode: c.exemptionCode ?? null,
        },
      });
      comps[c.abbr] = row.id;
    }
    await tx.company.update({ where: { id: companyId }, data: { basicComponentName: 'BASIC', hraComponentName: 'HRA' } });
    await tx.salaryStructure.create({
      data: {
        companyId, name: 'Standard CTC Structure', description: 'Basic 50% of CTC (labour-code wages), HRA 40% of Basic, balancing Special Allowance', payrollFrequency: 'MONTHLY',
        components: { create: DEFAULT_STRUCTURE.map((d, i) => ({ componentId: comps[d.abbr], formula: d.formula, sortOrder: i + 1 })) },
      },
    });

    // default general shift
    await tx.shiftType.create({
      data: {
        companyId, name: 'General Shift', startTime: '09:30', endTime: '18:30', workingHours: 8, halfDayThresholdHours: 4,
        lateEntryGraceMinutes: 15, earlyExitGraceMinutes: 0, allowCheckInBeforeMinutes: 120, allowCheckOutAfterMinutes: 240,
      },
    });

    // holiday lists
    for (const [yearStr, holidays] of Object.entries(DEFAULT_HOLIDAYS)) {
      await tx.holidayList.create({
        data: {
          companyId, name: `National Holidays ${yearStr}`, year: Number(yearStr), isDefault: true,
          holidays: { create: holidays.map((h) => ({ name: h.name, date: toDateOnly(h.date), isOptional: !!h.optional })) },
        },
      });
    }
  }
}
