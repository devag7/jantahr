import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { AccessService } from '../../common/access/access.service';
import { StorageService, uploadScope } from '../../common/storage/storage.service';
import { ADMIN_ROLES, AuthUser } from '../../common/types';
import { toDateOnly, todayIST } from '../../common/utils/dates';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { Prisma, ExpenseStatus } from '@prisma/client';
export const EXPENSE_CATEGORIES = ['Travel', 'Accommodation', 'Meals', 'Fuel', 'Client Entertainment', 'Communication', 'Office Supplies', 'Training', 'Medical', 'Other'];

export class ExpenseItemDto {
  @IsDateString() expenseDate: string;
  @IsString() category: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsNumber() @Min(1) amount: number;
  @IsOptional() @IsString() receiptUrl?: string;
}
export class ExpenseClaimDto {
  @IsString() @MinLength(3) title: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ExpenseItemDto) items: ExpenseItemDto[];
  @IsOptional() submit?: boolean;
}
export class UpdateExpenseClaimDto extends PartialType(ExpenseClaimDto) {}

export class ApproveItemDto {
  @IsString() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0) approvedAmount: number;
}
export class ExpenseDecisionDto {
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ApproveItemDto) items?: ApproveItemDto[];
}

export class TravelRequestDto {
  @IsString() @MinLength(3) purpose: string;
  @IsString() fromLocation: string;
  @IsString() toLocation: string;
  @IsDateString() departureDate: string;
  @IsDateString() returnDate: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) advanceRequired?: number;
}

const INCLUDE = { items: true, employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } };

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService, private access: AccessService, private notifications: NotificationsService, private storage: StorageService) {}

  private total(items: { amount: number }[]) {
    return round2(items.reduce((s, i) => s + i.amount, 0));
  }

  private validateItems(items: ExpenseItemDto[]) {
    for (const i of items) {
      if (toDateOnly(i.expenseDate) > todayIST()) throw new BadRequestException('Expense date cannot be in the future');
      if (!EXPENSE_CATEGORIES.includes(i.category)) throw new BadRequestException(`Unknown category "${i.category}"`);
    }
  }

  async create(user: AuthUser, dto: ExpenseClaimDto) {
    const empId = this.access.requireEmployee(user);
    this.validateItems(dto.items);
    const claim = await this.prisma.expenseClaim.create({
      data: {
        companyId: user.companyId, employeeId: empId, title: dto.title, totalClaimed: this.total(dto.items), status: dto.submit ? 'SUBMITTED' : 'DRAFT', submittedAt: dto.submit ? new Date() : null,
        items: { create: dto.items.map((i) => ({ expenseDate: toDateOnly(i.expenseDate), category: i.category, description: i.description, amount: i.amount, receiptUrl: i.receiptUrl })) },
      },
      include: INCLUDE,
    });
    if (dto.submit) await this.notifyApprover(user, claim.employeeId, claim.title);
    return claim;
  }

  private async notifyApprover(user: AuthUser, employeeId: string, title: string) {
    const me = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { firstName: true, lastName: true, expenseApproverId: true, reportingManagerId: true } });
    const msg = { title: 'Expense claim to approve', message: `${me.firstName} ${me.lastName}: ${title}`, type: 'APPROVAL', link: '/admin/dashboard' };
    if (me.expenseApproverId || me.reportingManagerId) await this.notifications.notifyEmployee(me.expenseApproverId || me.reportingManagerId, msg);
    else await this.notifications.notifyRoles(user.companyId, ['HR_ADMIN', 'SUPER_ADMIN'], msg);
  }

  private async own(user: AuthUser, id: string) {
    const c = await this.prisma.expenseClaim.findFirst({ where: { id, companyId: user.companyId }, include: INCLUDE });
    if (!c) throw new NotFoundException('Claim not found');
    return c;
  }

  async update(user: AuthUser, id: string, dto: UpdateExpenseClaimDto) {
    const c = await this.own(user, id);
    if (c.employeeId !== user.employeeId) throw new ForbiddenException();
    if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new BadRequestException('Only draft or rejected claims can be edited');
    if (dto.items) this.validateItems(dto.items);
    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.expenseClaimItem.deleteMany({ where: { claimId: id } });
        await tx.expenseClaimItem.createMany({ data: dto.items.map((i) => ({ claimId: id, expenseDate: toDateOnly(i.expenseDate), category: i.category, description: i.description, amount: i.amount, receiptUrl: i.receiptUrl })) });
      }
      await tx.expenseClaim.update({
        where: { id }, data: { ...(dto.title ? { title: dto.title } : {}), ...(dto.items ? { totalClaimed: this.total(dto.items) } : {}), status: dto.submit ? 'SUBMITTED' : c.status, submittedAt: dto.submit ? new Date() : c.submittedAt },
      });
    });
    if (dto.submit) await this.notifyApprover(user, c.employeeId, c.title);
    return this.own(user, id);
  }

  async submit(user: AuthUser, id: string) {
    const c = await this.own(user, id);
    if (c.employeeId !== user.employeeId) throw new ForbiddenException();
    if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new BadRequestException('Claim is already submitted');
    if (!c.items.length) throw new BadRequestException('Add at least one expense line');
    await this.prisma.expenseClaim.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
    await this.notifyApprover(user, c.employeeId, c.title);
    return this.own(user, id);
  }

  async remove(user: AuthUser, id: string) {
    const c = await this.own(user, id);
    if (c.employeeId !== user.employeeId) throw new ForbiddenException();
    if (c.status !== 'DRAFT') throw new BadRequestException('Only draft claims can be deleted');
    await this.prisma.expenseClaim.delete({ where: { id } });
    return { ok: true };
  }

  async uploadReceipt(user: AuthUser, file?: Express.Multer.File, ticket?: string) {
    const empId = this.access.requireEmployee(user);
    const saved = await this.storage.accept(`receipts/${empId}`, uploadScope(user), file, ticket);
    return { receiptUrl: saved.key, name: saved.name };
  }

  async downloadReceipt(user: AuthUser, key: string) {
    const claim = await this.prisma.expenseClaimItem.findFirst({ where: { receiptUrl: key, claim: { companyId: user.companyId } }, include: { claim: true } });
    if (!claim) throw new NotFoundException('Receipt not found');
    if (claim.claim.employeeId !== user.employeeId && !(await this.access.canApproveFor(user, claim.claim.employeeId)) && !['PAYROLL_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) throw new ForbiddenException();
    return key;
  }

  async list(user: AuthUser, scope: 'mine' | 'team' | 'all', status?: string) {
    let where: Prisma.ExpenseClaimWhereInput = { companyId: user.companyId, ...(status ? { status: status as ExpenseStatus } : {}) };
    if (scope === 'mine') where.employeeId = this.access.requireEmployee(user);
    else if (scope === 'team') where = { ...where, ...(await this.access.approvalFilter(user)) };
    else {
      const ids = await this.access.scopeEmployeeIds(user);
      if (ids) where.employeeId = { in: ids.filter((i) => i !== user.employeeId || ADMIN_ROLES.includes(user.role)) };
    }
    return this.prisma.expenseClaim.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async decide(user: AuthUser, id: string, approve: boolean, dto: ExpenseDecisionDto) {
    const c = await this.own(user, id);
    await this.access.assertCanApproveFor(user, c.employeeId);
    if (c.status !== 'SUBMITTED') throw new BadRequestException('Claim is not awaiting approval');
    if (!approve) {
      const r = await this.prisma.expenseClaim.update({ where: { id }, data: { status: 'REJECTED', approverId: user.employeeId, approverComment: dto.comment }, include: INCLUDE });
      await this.notifications.notifyEmployee(c.employeeId, { title: 'Expense claim rejected', message: dto.comment || c.title, type: 'EXPENSE', link: '/ess/dashboard' });
      return r;
    }
    const overrides = new Map((dto.items || []).map((i) => [i.itemId, i.approvedAmount]));
    let total = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of c.items) {
        const amt = Math.min(overrides.get(item.id) ?? num(item.amount), num(item.amount));
        total += amt;
        await tx.expenseClaimItem.update({ where: { id: item.id }, data: { approvedAmount: amt } });
      }
      await tx.expenseClaim.update({ where: { id }, data: { status: 'APPROVED', totalApproved: round2(total), approverId: user.employeeId, approverComment: dto.comment } });
    });
    await this.notifications.notifyEmployee(c.employeeId, { title: 'Expense claim approved', message: `₹${round2(total)} approved: it will be reimbursed with your next salary`, type: 'EXPENSE', link: '/ess/dashboard' });
    return this.own(user, id);
  }

  // ---- travel ----
  async createTravel(user: AuthUser, dto: TravelRequestDto) {
    const empId = this.access.requireEmployee(user);
    if (toDateOnly(dto.returnDate) < toDateOnly(dto.departureDate)) throw new BadRequestException('Return date is before departure');
    const t = await this.prisma.travelRequest.create({ data: { ...dto, departureDate: toDateOnly(dto.departureDate), returnDate: toDateOnly(dto.returnDate), employeeId: empId, companyId: user.companyId } });
    await this.notifyApprover(user, empId, `Travel: ${dto.purpose}`);
    return t;
  }

  async listTravel(user: AuthUser, scope: 'mine' | 'team') {
    const who = scope === 'mine' ? { employeeId: this.access.requireEmployee(user) } : await this.access.approvalFilter(user);
    return this.prisma.travelRequest.findMany({ where: { companyId: user.companyId, ...who }, include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async decideTravel(user: AuthUser, id: string, approve: boolean, comment?: string) {
    const t = await this.prisma.travelRequest.findFirst({ where: { id, companyId: user.companyId } });
    if (!t) throw new NotFoundException('Request not found');
    await this.access.assertCanApproveFor(user, t.employeeId);
    if (t.status !== 'PENDING') throw new BadRequestException('Already processed');
    const r = await this.prisma.travelRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', approverComment: comment } });
    await this.notifications.notifyEmployee(t.employeeId, { title: `Travel request ${approve ? 'approved' : 'rejected'}`, message: t.purpose, type: 'EXPENSE', link: '/ess/dashboard' });
    return r;
  }
}
