import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ADMIN_ROLES, AuthUser } from '../../common/types';
import { AccessService } from '../../common/access/access.service';
import { requestDueDate } from '../../common/consent/consent-rules';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivacyRequestDto, PrivacyRequestUpdateDto } from './privacy.dto';

import { PrivacyRequestStatus } from '@prisma/client';
const TITLE: Record<string, string> = { ACCESS: 'Access to my data', CORRECTION: 'Correction of my data', ERASURE: 'Erasure of my data', GRIEVANCE: 'Grievance', NOMINATION: 'Nomination' };

/** Data-principal rights under DPDP Act 2023 ss.11-14: access, correction/erasure, grievance redressal, nomination. */
@Injectable()
export class PrivacyRequestsService {
  constructor(private prisma: PrismaService, private access: AccessService, private notifications: NotificationsService) {}

  async create(user: AuthUser, dto: PrivacyRequestDto) {
    const employeeId = this.access.requireEmployee(user);
    const r = await this.prisma.privacyRequest.create({ data: { companyId: user.companyId, employeeId, type: dto.type, details: dto.details, dueDate: requestDueDate(new Date()) } });
    await this.notifications.notifyRoles(user.companyId, ['HR_ADMIN', 'SUPER_ADMIN'], { title: `Privacy request: ${TITLE[dto.type]}`, message: dto.details.slice(0, 140), type: 'PRIVACY', link: '/hr/privacy' });
    return r;
  }

  mine(user: AuthUser) {
    return this.prisma.privacyRequest.findMany({ where: { employeeId: this.access.requireEmployee(user) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async list(user: AuthUser, status?: string) {
    const rows = await this.prisma.privacyRequest.findMany({
      where: { companyId: user.companyId, ...(status ? { status: status as PrivacyRequestStatus } : {}) },
      orderBy: { createdAt: 'desc' }, take: 300,
    });
    const emps = await this.prisma.employee.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.employeeId))] } }, select: { id: true, firstName: true, lastName: true, employeeCode: true, status: true } });
    const byId = new Map(emps.map((e) => [e.id, e]));
    const now = Date.now();
    return rows.map((r) => ({ ...r, employee: byId.get(r.employeeId) ?? null, overdue: (r.status === 'OPEN' || r.status === 'IN_PROGRESS') && r.dueDate.getTime() < now }));
  }

  async update(user: AuthUser, id: string, dto: PrivacyRequestUpdateDto) {
    if (!ADMIN_ROLES.includes(user.role)) throw new ForbiddenException();
    const r = await this.prisma.privacyRequest.findFirst({ where: { id, companyId: user.companyId } });
    if (!r) throw new NotFoundException('Request not found');
    if (r.status === 'COMPLETED' || r.status === 'REJECTED') throw new BadRequestException('This request is already closed');
    const closing = dto.status === 'COMPLETED' || dto.status === 'REJECTED';
    if (closing && !(dto.resolution ?? r.resolution)?.trim()) throw new BadRequestException('Add a resolution note before closing the request: the employee will see it');
    const updated = await this.prisma.privacyRequest.update({
      where: { id },
      data: { status: dto.status, resolution: dto.resolution ?? undefined, ...(closing ? { resolvedById: user.userId, resolvedAt: new Date() } : {}) },
    });
    if (dto.status && dto.status !== r.status) await this.notifications.notifyEmployee(r.employeeId, { title: `Your privacy request is ${dto.status.toLowerCase().replace('_', ' ')}`, message: dto.resolution?.slice(0, 160) ?? TITLE[r.type], type: 'PRIVACY', link: '/me/privacy' });
    return updated;
  }
}
