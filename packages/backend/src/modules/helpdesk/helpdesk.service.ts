import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketPriority, TicketStatus, Prisma } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AccessService } from '../../common/access/access.service';
import { ADMIN_ROLES, AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const TICKET_CATEGORIES = ['Payroll', 'Leave', 'Attendance', 'IT', 'Benefits', 'Policy', 'Documents', 'Other'];

export class TicketDto {
  @IsString() @MinLength(3) subject: string;
  @IsString() @MinLength(3) description: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
}
export class TicketUpdateDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
}
export class CommentDto {
  @IsString() @MinLength(1) message: string;
}

@Injectable()
export class HelpdeskService {
  constructor(private prisma: PrismaService, private access: AccessService, private notifications: NotificationsService) {}

  async create(user: AuthUser, dto: TicketDto) {
    const empId = this.access.requireEmployee(user);
    const category = dto.category && TICKET_CATEGORIES.includes(dto.category) ? dto.category : 'Other';
    const t = await this.prisma.helpdeskTicket.create({ data: { companyId: user.companyId, employeeId: empId, subject: dto.subject, description: dto.description, category, priority: dto.priority || 'MEDIUM' } });
    await this.notifications.notifyRoles(user.companyId, ['HR_ADMIN'], { title: 'New helpdesk ticket', message: dto.subject, type: 'TICKET', link: '/admin/dashboard' });
    return t;
  }

  list(user: AuthUser, scope: 'mine' | 'all', status?: string) {
    const where: Prisma.HelpdeskTicketWhereInput = { companyId: user.companyId, ...(status ? { status: status as TicketStatus } : {}) };
    if (scope === 'mine' || !ADMIN_ROLES.includes(user.role)) where.employeeId = this.access.requireEmployee(user);
    return this.prisma.helpdeskTicket.findMany({
      where, include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, _count: { select: { comments: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  private async getFor(user: AuthUser, id: string) {
    const t = await this.prisma.helpdeskTicket.findFirst({ where: { id, companyId: user.companyId }, include: { comments: { orderBy: { createdAt: 'asc' } }, employee: { select: { firstName: true, lastName: true, employeeCode: true, userId: true } } } });
    if (!t) throw new NotFoundException('Ticket not found');
    if (!ADMIN_ROLES.includes(user.role) && t.employeeId !== user.employeeId) throw new ForbiddenException();
    return t;
  }

  one(user: AuthUser, id: string) { return this.getFor(user, id); }

  async comment(user: AuthUser, id: string, dto: CommentDto) {
    const t = await this.getFor(user, id);
    if (t.status === 'CLOSED') throw new BadRequestException('Ticket is closed');
    const me = user.employeeId ? await this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { firstName: true, lastName: true } }) : null;
    const c = await this.prisma.helpdeskComment.create({ data: { ticketId: id, authorId: user.userId, authorName: me ? `${me.firstName} ${me.lastName}`.trim() : user.email, message: dto.message } });
    if (t.employeeId !== user.employeeId) await this.notifications.notifyEmployee(t.employeeId, { title: 'Reply on your ticket', message: t.subject, type: 'TICKET', link: '/ess/dashboard' });
    return c;
  }

  async update(user: AuthUser, id: string, dto: TicketUpdateDto) {
    const t = await this.getFor(user, id);
    const isAdmin = ADMIN_ROLES.includes(user.role);
    if (!isAdmin) {
      if (dto.status !== 'CLOSED' || Object.keys(dto).length > 1) throw new ForbiddenException('You can only close your own ticket');
    }
    const r = await this.prisma.helpdeskTicket.update({ where: { id }, data: dto });
    if (isAdmin && dto.status && dto.status !== t.status) await this.notifications.notifyEmployee(t.employeeId, { title: `Ticket ${dto.status.toLowerCase().replace('_', ' ')}`, message: t.subject, type: 'TICKET', link: '/ess/dashboard' });
    return r;
  }
}
