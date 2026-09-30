import { Injectable } from '@nestjs/common';
import { num, round2 } from '../../common/utils/money';
import { toDateOnly } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';

import { Prisma } from '@prisma/client';
export interface LeaveBalanceRow {
  leaveTypeId: string; leaveType: string; allocated: number; carryForwarded: number; used: number; pending: number; available: number;
  isLWP: boolean; isEncashable: boolean; isPaid: boolean;
}

@Injectable()
export class LeaveBalanceService {
  constructor(private prisma: PrismaService) {}

  /** Allocations valid on the given date, net of approved usage and pending (OPEN) applications. */
  async getBalances(employeeId: string, asOf: Date = new Date()): Promise<LeaveBalanceRow[]> {
    const date = toDateOnly(asOf);
    const [allocs, open, types] = await Promise.all([
      this.prisma.leaveAllocation.findMany({ where: { employeeId, fromDate: { lte: date }, toDate: { gte: date } } }),
      this.prisma.leaveApplication.findMany({ where: { employeeId, status: 'OPEN' } }),
      this.prisma.leaveType.findMany({ where: { leaveAllocations: { some: { employeeId } } } }),
    ]);
    const typeMap = new Map(types.map((t) => [t.id, t]));
    const rows = new Map<string, LeaveBalanceRow>();
    for (const a of allocs) {
      const t = typeMap.get(a.leaveTypeId);
      if (!t) continue;
      const r = rows.get(a.leaveTypeId) || {
        leaveTypeId: t.id, leaveType: t.name, allocated: 0, carryForwarded: 0, used: 0, pending: 0, available: 0, isLWP: t.isLWP, isEncashable: t.isEncashable, isPaid: t.isPaid,
      };
      r.allocated += num(a.totalLeavesAllocated);
      r.carryForwarded += num(a.carryForwardedLeaves);
      r.used += num(a.usedLeaves);
      rows.set(a.leaveTypeId, r);
    }
    for (const o of open) {
      const r = rows.get(o.leaveTypeId);
      if (r) r.pending += num(o.totalLeaveDays);
    }
    return [...rows.values()]
      .map((r) => ({ ...r, allocated: round2(r.allocated), used: round2(r.used), pending: round2(r.pending), available: round2(r.allocated - r.used - r.pending) }))
      .sort((a, b) => a.leaveType.localeCompare(b.leaveType));
  }

  async getAvailable(employeeId: string, leaveTypeId: string, asOf: Date): Promise<number> {
    return (await this.getBalances(employeeId, asOf)).find((b) => b.leaveTypeId === leaveTypeId)?.available ?? 0;
  }

  /** Deduct days from allocations covering `onDate`, earliest-expiring first. */
  async consume(tx: Prisma.TransactionClient, employeeId: string, leaveTypeId: string, days: number, onDate: Date, allowNegative: boolean) {
    const allocs = await tx.leaveAllocation.findMany({ where: { employeeId, leaveTypeId, fromDate: { lte: onDate }, toDate: { gte: onDate } }, orderBy: { toDate: 'asc' } });
    let remaining = days;
    for (const a of allocs) {
      const free = num(a.totalLeavesAllocated) - num(a.usedLeaves);
      const take = Math.min(remaining, Math.max(0, free));
      if (take > 0) {
        await tx.leaveAllocation.update({ where: { id: a.id }, data: { usedLeaves: { increment: take } } });
        remaining = round2(remaining - take);
      }
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      if (!allowNegative) throw new Error('Insufficient leave balance');
      const target = allocs[0];
      if (target) await tx.leaveAllocation.update({ where: { id: target.id }, data: { usedLeaves: { increment: remaining } } });
    }
    await tx.leaveLedgerEntry.create({ data: { employeeId, leaveTypeId, transactionType: 'LEAVE', leaves: -days, fromDate: onDate } });
  }

  async refund(tx: Prisma.TransactionClient, employeeId: string, leaveTypeId: string, days: number, onDate: Date) {
    const allocs = await tx.leaveAllocation.findMany({ where: { employeeId, leaveTypeId, fromDate: { lte: onDate }, toDate: { gte: onDate }, usedLeaves: { gt: 0 } }, orderBy: { toDate: 'desc' } });
    let remaining = days;
    for (const a of allocs) {
      const give = Math.min(remaining, num(a.usedLeaves));
      await tx.leaveAllocation.update({ where: { id: a.id }, data: { usedLeaves: { decrement: give } } });
      remaining = round2(remaining - give);
      if (remaining <= 0) break;
    }
    await tx.leaveLedgerEntry.create({ data: { employeeId, leaveTypeId, transactionType: 'LEAVE_CANCELLED', leaves: days, fromDate: onDate } });
  }
}
