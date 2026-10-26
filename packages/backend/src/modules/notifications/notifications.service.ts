import { SupabaseService } from '../supabase/supabase.service';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';
import { PushService } from './push.service';

export interface NotifyInput {
  title: string;
  message: string;
  type?: string;
  link?: string;
  email?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService, private mail: MailService, private supabase: SupabaseService, private push: PushService) {}

  async notifyUser(userId: string, input: NotifyInput) {
    const n = await this.prisma.notification.create({
      data: { userId, title: input.title, message: input.message, type: input.type || 'INFO', link: input.link },
      include: { user: { select: { email: true } } },
    });
    void this.supabase.pingUser(userId); // live update for open tabs (no-op without Supabase Realtime)
    // the phone, if the user has the app with notifications on (awaited: a serverless function may stop after replying)
    await this.push.toUser(userId, { title: n.title, message: n.message, link: n.link, id: n.id });
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

  /** Remembers a phone for push; a token moves to whoever signed in on that phone last. */
  registerDevice(userId: string, token: string, platform: string) {
    return this.prisma.pushDevice.upsert({ where: { token }, create: { userId, token, platform }, update: { userId, platform, lastSeenAt: new Date() } });
  }

  /** Signing out on a phone stops its pushes. */
  removeDevice(userId: string, token: string) {
    return this.prisma.pushDevice.deleteMany({ where: { userId, token } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}
