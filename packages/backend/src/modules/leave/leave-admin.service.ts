import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { toDateOnly, todayIST } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaveAllocationService } from './leave-allocation.service';
import { AssignPolicyDto, LeavePolicyDto, LeaveTypeDto, ManualAllocationDto, UpdateLeavePolicyDto, UpdateLeaveTypeDto } from './leave.dto';

@Injectable()
export class LeaveAdminService {
  constructor(private prisma: PrismaService, private allocations: LeaveAllocationService) {}

  // ---- types ----
  types(companyId: string) {
    return this.prisma.leaveType.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  createType(companyId: string, dto: LeaveTypeDto) {
    return this.prisma.leaveType.create({ data: { ...dto, companyId } });
  }

  async updateType(companyId: string, id: string, dto: UpdateLeaveTypeDto) {
    if (!(await this.prisma.leaveType.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Leave type not found');
    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }

  async deleteType(companyId: string, id: string) {
    const lt = await this.prisma.leaveType.findFirst({ where: { id, companyId }, include: { _count: { select: { leaveApplications: true, leaveAllocations: true } } } });
    if (!lt) throw new NotFoundException('Leave type not found');
    if (lt._count.leaveApplications || lt._count.leaveAllocations) throw new BadRequestException('This leave type is in use and cannot be deleted');
    await this.prisma.$transaction([this.prisma.leavePolicyDetail.deleteMany({ where: { leaveTypeId: id } }), this.prisma.leaveType.delete({ where: { id } })]);
    return { ok: true };
  }

  // ---- policies ----
  policies(companyId: string) {
    return this.prisma.leavePolicy.findMany({
      where: { companyId }, orderBy: { name: 'asc' },
      include: { details: { include: { leaveType: { select: { id: true, name: true } } } }, _count: { select: { assignments: true } } },
    });
  }

  private async assertTypes(companyId: string, ids: string[]) {
    const found = await this.prisma.leaveType.count({ where: { companyId, id: { in: ids } } });
    if (found !== new Set(ids).size) throw new BadRequestException('One or more leave types are invalid');
  }

  async createPolicy(companyId: string, dto: LeavePolicyDto) {
    await this.assertTypes(companyId, dto.details.map((d) => d.leaveTypeId));
    return this.prisma.leavePolicy.create({
      data: { name: dto.name, companyId, isActive: dto.isActive ?? true, details: { create: dto.details.map((d) => ({ leaveTypeId: d.leaveTypeId, annualAllocation: d.annualAllocation })) } },
      include: { details: true },
    });
  }

  async updatePolicy(companyId: string, id: string, dto: UpdateLeavePolicyDto) {
    if (!(await this.prisma.leavePolicy.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Policy not found');
    if (dto.details) await this.assertTypes(companyId, dto.details.map((d) => d.leaveTypeId));
    return this.prisma.$transaction(async (tx) => {
      if (dto.details) await tx.leavePolicyDetail.deleteMany({ where: { leavePolicyId: id } });
      return tx.leavePolicy.update({
        where: { id },
        data: { ...(dto.name ? { name: dto.name } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}), ...(dto.details ? { details: { create: dto.details.map((d) => ({ leaveTypeId: d.leaveTypeId, annualAllocation: d.annualAllocation })) } } : {}) },
        include: { details: true },
      });
    });
  }

  async assignPolicy(companyId: string, policyId: string, dto: AssignPolicyDto, assignedById?: string | null) {
    if (!(await this.prisma.leavePolicy.findFirst({ where: { id: policyId, companyId } }))) throw new NotFoundException('Policy not found');
    const emps = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', ...(dto.allEmployees ? {} : { id: { in: dto.employeeIds || [] } }) }, select: { id: true },
    });
    if (!emps.length) throw new BadRequestException('No employees selected');
    const effectiveFrom = dto.effectiveFrom ? toDateOnly(dto.effectiveFrom) : toDateOnly(todayIST());
    for (const e of emps) {
      await this.prisma.leavePolicyAssignment.upsert({
        where: { leavePolicyId_employeeId_effectiveFrom: { leavePolicyId: policyId, employeeId: e.id, effectiveFrom } },
        create: { leavePolicyId: policyId, employeeId: e.id, companyId, effectiveFrom, assignedById: assignedById ?? undefined }, update: {},
      });
      await this.allocations.allocateForEmployee(e.id, effectiveFrom.getUTCFullYear());
    }
    return { assigned: emps.length };
  }

  // ---- allocations ----
  allocationsList(companyId: string, employeeId?: string) {
    return this.prisma.leaveAllocation.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, leaveType: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 300,
    });
  }

  async manualAllocation(companyId: string, dto: ManualAllocationDto) {
    if (!(await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } }))) throw new BadRequestException('Employee not found');
    return this.allocations.manualAllocate(companyId, dto.employeeId, dto.leaveTypeId, dto.days, toDateOnly(dto.fromDate), toDateOnly(dto.toDate), dto.reason || 'Manual allocation');
  }
}
