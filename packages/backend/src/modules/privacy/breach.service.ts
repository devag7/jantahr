import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { breachBoardDeadline } from '../../common/consent/consent-rules';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BreachDto, BreachUpdateDto } from './privacy.dto';

/** Personal-data breach register (DPDP s.8(6): report to the Data Protection Board and affected principals). Tracks the workflow; does not file with the Board. */
@Injectable()
export class BreachService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async create(user: AuthUser, dto: BreachDto) {
    const b = await this.prisma.dataBreach.create({
      data: {
        companyId: user.companyId, title: dto.title, description: dto.description, severity: dto.severity, reportedById: user.userId,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : null, detectedAt: dto.detectedAt ? new Date(dto.detectedAt) : new Date(),
        affectedCount: dto.affectedCount, dataCategories: dto.dataCategories, containmentActions: dto.containmentActions,
      },
    });
    await this.notifications.notifyRoles(user.companyId, ['SUPER_ADMIN'], { title: `Data breach logged (${dto.severity})`, message: dto.title, type: 'PRIVACY', link: '/hr/privacy', email: true });
    return b;
  }

  async list(companyId: string) {
    const rows = await this.prisma.dataBreach.findMany({ where: { companyId }, orderBy: { detectedAt: 'desc' }, take: 200 });
    const now = Date.now();
    return rows.map((b) => {
      const boardDueAt = breachBoardDeadline(b.detectedAt);
      return { ...b, boardDueAt, boardOverdue: !b.boardNotifiedAt && b.status !== 'CLOSED' && boardDueAt.getTime() < now };
    });
  }

  private async get(companyId: string, id: string) {
    const b = await this.prisma.dataBreach.findFirst({ where: { id, companyId } });
    if (!b) throw new NotFoundException('Breach record not found');
    return b;
  }

  async update(user: AuthUser, id: string, dto: BreachUpdateDto) {
    const b = await this.get(user.companyId, id);
    if (b.status === 'CLOSED') throw new BadRequestException('This breach is closed');
    if (dto.status === 'CLOSED' && !b.boardNotifiedAt && !dto.boardNotified) throw new BadRequestException('Record that the Data Protection Board was notified before closing a breach');
    const { boardNotified, ...rest } = dto;
    return this.prisma.dataBreach.update({ where: { id }, data: { ...rest, ...(boardNotified && !b.boardNotifiedAt ? { boardNotifiedAt: new Date() } : {}) } });
  }

  /** In-app + email notice to every active employee (the affected-principal notification). */
  async notifyEmployees(user: AuthUser, id: string) {
    const b = await this.get(user.companyId, id);
    if (b.principalsNotifiedAt) throw new BadRequestException('Employees have already been notified');
    const users = await this.prisma.user.findMany({ where: { companyId: user.companyId, isActive: true, employee: { isNot: null } }, select: { id: true } });
    const message = `We identified a personal-data incident: ${b.title}. ${b.dataCategories ? `Data involved: ${b.dataCategories}. ` : ''}Contact HR or raise a grievance under Privacy for details.`;
    await Promise.all(users.map((u) => this.notifications.notifyUser(u.id, { title: 'Important: data incident notice', message, type: 'PRIVACY', link: '/me/privacy', email: true })));
    return this.prisma.dataBreach.update({ where: { id }, data: { principalsNotifiedAt: new Date(), status: b.status === 'INVESTIGATING' || b.status === 'CONTAINED' ? 'NOTIFIED' : b.status } });
  }
}
