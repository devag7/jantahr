import { inProcessJobs } from '../../common/utils/jobs-mode';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaveType, Prisma, LeaveAllocation } from '@prisma/client';
import { num, round2 } from '../../common/utils/money';
import { addDays, diffDays, todayIST, utcDate } from '../../common/utils/dates';
import { runExclusive } from '../../common/utils/cron-lock';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

const roundHalf = (n: number) => Math.round(n * 2) / 2;

@Injectable()
export class LeaveAllocationService {
  private readonly logger = new Logger(LeaveAllocationService.name);
  constructor(private prisma: PrismaService) {}

  yearBounds(year: number) {
    return { from: utcDate(year, 1, 1), to: utcDate(year, 12, 31) };
  }

  /** Called when an employee record is created: assign default policy and allocate for the joining year. */
  async onEmployeeJoined(employeeId: string) {
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const policy = await this.prisma.leavePolicy.findFirst({ where: { companyId: emp.companyId, isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!policy) return;
    await this.prisma.leavePolicyAssignment.upsert({
      where: { leavePolicyId_employeeId_effectiveFrom: { leavePolicyId: policy.id, employeeId, effectiveFrom: emp.dateOfJoining } },
      create: { leavePolicyId: policy.id, employeeId, companyId: emp.companyId, effectiveFrom: emp.dateOfJoining }, update: {},
    });
    await this.allocateForEmployee(employeeId, Math.max(emp.dateOfJoining.getUTCFullYear(), todayIST().getUTCFullYear()));
  }

  private async currentPolicy(db: Db, employeeId: string, asOf: Date) {
    const a = await db.leavePolicyAssignment.findFirst({
      where: { employeeId, effectiveFrom: { lte: asOf } }, orderBy: { effectiveFrom: 'desc' },
      include: { leavePolicy: { include: { details: { include: { leaveType: true } } } } },
    });
    return a?.leavePolicy ?? null;
  }

  /** Idempotent yearly allocation incl. carry-forward from the previous year. Safe to re-run. */
  async allocateForEmployee(employeeId: string, year: number) {
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const { from, to } = this.yearBounds(year);
    const policy = await this.currentPolicy(this.prisma, employeeId, to);
    if (!policy) return [];
    const results: LeaveAllocation[] = [];

    for (const d of policy.details) {
      const lt = d.leaveType;
      if (lt.applicableGender && lt.applicableGender !== emp.gender) continue;
      if (lt.isLWP || lt.isCompensatory) continue;

      const annual = num(d.annualAllocation);
      let fresh = annual;
      const accrualMonths: Date[] = [];
      if (lt.isEarnedLeave) {
        // accrued monthly: credit every month already elapsed in this leave year (joiners after the 15th start next month)
        const now = todayIST();
        const lastMonth = year < now.getUTCFullYear() ? 12 : year > now.getUTCFullYear() ? 0 : now.getUTCMonth() + 1;
        for (let m = 1; m <= lastMonth; m++) {
          const ms = utcDate(year, m, 1);
          if (emp.dateOfJoining > utcDate(year, m + 1, 0)) continue;
          if (emp.dateOfJoining >= ms && emp.dateOfJoining.getUTCDate() > 15) continue;
          accrualMonths.push(ms);
        }
        const cap = lt.maxDaysAllowed === null ? Infinity : num(lt.maxDaysAllowed);
        fresh = Math.min(cap, round2((annual / 12) * accrualMonths.length));
      } else if (!lt.applicableGender && annual >= 10 && emp.dateOfJoining > from) {
        const daysLeft = Math.max(0, diffDays(to, emp.dateOfJoining) + 1);
        fresh = roundHalf((annual * daysLeft) / 365);
      }

      let carry = 0;
      if (lt.isCarryForward) carry = await this.carryForwardFor(employeeId, lt, year);

      const existing = await this.prisma.leaveAllocation.findFirst({ where: { employeeId, leaveTypeId: lt.id, fromDate: from } });
      if (existing) {
        // keep accrued/manual credit; only refresh the policy portion when nothing has been used yet
        results.push(existing);
        continue;
      }
      const alloc = await this.prisma.$transaction(async (tx) => {
        const a = await tx.leaveAllocation.create({
          data: { employeeId, leaveTypeId: lt.id, companyId: emp.companyId, fromDate: from, toDate: to, newLeavesAllocated: fresh, carryForwardedLeaves: carry, totalLeavesAllocated: fresh + carry },
        });
        if (lt.isEarnedLeave) {
          const per = accrualMonths.length ? round2(fresh / accrualMonths.length) : 0;
          for (const ms of accrualMonths) {
            await tx.leaveLedgerEntry.create({ data: { employeeId, leaveTypeId: lt.id, transactionType: 'ACCRUAL', leaves: per, fromDate: ms, toDate: addDays(utcDate(year, ms.getUTCMonth() + 2, 1), -1) } });
          }
        } else if (fresh) await tx.leaveLedgerEntry.create({ data: { employeeId, leaveTypeId: lt.id, transactionType: 'ALLOCATION', leaves: fresh, fromDate: from, toDate: to } });
        if (carry) await tx.leaveLedgerEntry.create({ data: { employeeId, leaveTypeId: lt.id, transactionType: 'CARRY_FORWARD', leaves: carry, fromDate: from, toDate: to, isCarryForward: true } });
        return a;
      });
      results.push(alloc);
    }
    return results;
  }

  private async carryForwardFor(employeeId: string, lt: LeaveType, year: number): Promise<number> {
    const prev = this.yearBounds(year - 1);
    const a = await this.prisma.leaveAllocation.findFirst({ where: { employeeId, leaveTypeId: lt.id, fromDate: prev.from } });
    if (!a) return 0;
    const balance = num(a.totalLeavesAllocated) - num(a.usedLeaves);
    if (balance <= 0) return 0;
    const cap = lt.maxCarryForwardDays === null ? balance : num(lt.maxCarryForwardDays);
    return Math.min(balance, cap);
  }

  /** Monthly earned-leave accrual. Idempotent per employee/type/month via the ledger. */
  async accrueEarnedLeaves(asOf: Date = todayIST(), companyId?: string) {
    const year = asOf.getUTCFullYear();
    const monthStart = utcDate(year, asOf.getUTCMonth() + 1, 1);
    const emps = await this.prisma.employee.findMany({ where: { status: 'ACTIVE', ...(companyId ? { companyId } : {}), dateOfJoining: { lte: asOf } } });
    let credited = 0;
    for (const emp of emps) {
      const policy = await this.currentPolicy(this.prisma, emp.id, asOf);
      if (!policy) continue;
      for (const d of policy.details.filter((x) => x.leaveType.isEarnedLeave)) {
        // joiners after the 15th earn from next month
        if (emp.dateOfJoining >= monthStart && emp.dateOfJoining.getUTCDate() > 15) continue;
        const already = await this.prisma.leaveLedgerEntry.findFirst({ where: { employeeId: emp.id, leaveTypeId: d.leaveTypeId, transactionType: 'ACCRUAL', fromDate: monthStart } });
        if (already) continue;
        await this.allocateForEmployee(emp.id, year);
        const alloc = await this.prisma.leaveAllocation.findFirst({ where: { employeeId: emp.id, leaveTypeId: d.leaveTypeId, fromDate: utcDate(year, 1, 1) } });
        if (!alloc) continue;
        let credit = round2(num(d.annualAllocation) / 12);
        const cap = d.leaveType.maxDaysAllowed === null ? Infinity : num(d.leaveType.maxDaysAllowed);
        credit = Math.max(0, Math.min(credit, cap - num(alloc.totalLeavesAllocated) + num(alloc.usedLeaves)));
        await this.prisma.$transaction([
          this.prisma.leaveAllocation.update({ where: { id: alloc.id }, data: { newLeavesAllocated: { increment: credit }, totalLeavesAllocated: { increment: credit } } }),
          this.prisma.leaveLedgerEntry.create({ data: { employeeId: emp.id, leaveTypeId: d.leaveTypeId, transactionType: 'ACCRUAL', leaves: credit, fromDate: monthStart, toDate: addDays(utcDate(year, asOf.getUTCMonth() + 2, 1), -1) } }),
        ]);
        credited++;
      }
    }
    this.logger.log(`Earned leave accrual for ${monthStart.toISOString().slice(0, 7)}: ${credited} credits`);
    return { credited };
  }

  async rolloverYear(year: number, companyId?: string) {
    const emps = await this.prisma.employee.findMany({ where: { status: 'ACTIVE', ...(companyId ? { companyId } : {}) }, select: { id: true } });
    for (const e of emps) await this.allocateForEmployee(e.id, year);
    return { employees: emps.length, year };
  }

  // ---- scheduled ----
  @Cron('30 0 1 * *', { timeZone: 'Asia/Kolkata' })
  async monthlyAccrualTick() {
    if (inProcessJobs()) await this.monthlyAccrualJob();
  }

  async monthlyAccrualJob() {
    await runExclusive(this.prisma, 'leave-monthly-accrual', () => this.accrueEarnedLeaves()).catch((e) => this.logger.error(`accrual failed: ${e.message}`));
  }

  @Cron('15 0 1 1 *', { timeZone: 'Asia/Kolkata' })
  async yearlyRolloverTick() {
    if (inProcessJobs()) await this.yearlyRolloverJob();
  }

  async yearlyRolloverJob() {
    await runExclusive(this.prisma, 'leave-yearly-rollover', () => this.rolloverYear(todayIST().getUTCFullYear())).catch((e) => this.logger.error(`rollover failed: ${e.message}`));
  }

  /** Manual/one-off credit (e.g. comp-off, HR adjustment). */
  async manualAllocate(companyId: string, employeeId: string, leaveTypeId: string, days: number, fromDate: Date, toDate: Date, reason?: string) {
    const lt = await this.prisma.leaveType.findFirstOrThrow({ where: { id: leaveTypeId, companyId } });
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.leaveAllocation.create({
        data: { employeeId, leaveTypeId: lt.id, companyId, fromDate, toDate, newLeavesAllocated: days, totalLeavesAllocated: days },
      });
      await tx.leaveLedgerEntry.create({ data: { employeeId, leaveTypeId: lt.id, transactionType: reason ? `ADJUSTMENT` : 'ALLOCATION', leaves: days, fromDate, toDate } });
      return a;
    });
  }
}
