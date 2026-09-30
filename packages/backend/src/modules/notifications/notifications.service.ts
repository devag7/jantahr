import { SupabaseService } from '../supabase/supabase.service';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';

export interface NotifyInput {
  title: string;
  message: string;
  type?: string;
  link?: string;
  email?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService, private mail: MailService, private supabase: SupabaseService) {}

  async notifyUser(userId: string, input: NotifyInput) {
    const n = await this.prisma.notification.create({
      data: { userId, title: input.title, message: input.message, type: input.type || 'INFO', link: input.link },
      include: { user: { select: { email: true } } },
    });
    void this.supabase.pingUser(userId); // live update for open tabs (no-op without Supabase Realtime)
    if (input.email) await this.mail.send(n.user.email, input.title, `<p>${input.message}</p>`);
    return n;
  }

  async notifyEmployee(employeeId: string | null | undefined, input: NotifyInput) {
    if (!employeeId) return;
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
    if (emp) await this.notifyUser(emp.userId, input);
  }

  async notifyRoles(companyId: string, roles: Role[], input: NotifyInput) {
    const users = await this.prisma.user.findMany({ where: { companyId, role: { in: roles }, isActive: true }, select: { id: true } });
    await Promise.all(users.map((u) => this.notifyUser(u.id, input)));
  }

  /** Notify an employee's leave/reporting approver, falling back to HR admins. */
  async notifyApproverOf(employeeId: string, companyId: string, input: NotifyInput) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { leaveApproverId: true, reportingManagerId: true } });
    const approver = emp?.leaveApproverId || emp?.reportingManagerId;
    if (approver) await this.notifyEmployee(approver, input);
    else await this.notifyRoles(companyId, [Role.HR_ADMIN, Role.SUPER_ADMIN], input);
  }

  list(userId: string, unreadOnly = false, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}
