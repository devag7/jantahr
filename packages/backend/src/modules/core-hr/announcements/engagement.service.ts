import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthUser } from '../../../common/types';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

export class AnnouncementDto {
  @IsString() @MinLength(2) title: string;
  @IsString() @MinLength(2) body: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsDateString() publishAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}
export class UpdateAnnouncementDto extends PartialType(AnnouncementDto) {}

export class PolicyDto {
  @IsString() @MinLength(2) title: string;
  @IsOptional() @IsString() category?: string;
  @IsString() @MinLength(2) content: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePolicyDto extends PartialType(PolicyDto) {}

@Injectable()
export class EngagementService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  // ---- announcements ----
  announcements(companyId: string, includeAll = false) {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: { companyId, ...(includeAll ? {} : { publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }) },
      orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }], take: 100,
    });
  }

  async createAnnouncement(user: AuthUser, dto: AnnouncementDto) {
    const a = await this.prisma.announcement.create({
      data: { companyId: user.companyId, title: dto.title, body: dto.body, pinned: !!dto.pinned, createdBy: user.userId, ...(dto.publishAt ? { publishAt: new Date(dto.publishAt) } : {}), ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}) },
    });
    const users = await this.prisma.user.findMany({ where: { companyId: user.companyId, isActive: true, id: { not: user.userId } }, select: { id: true } });
    await this.prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, title: 'New announcement', message: dto.title, type: 'ANNOUNCEMENT', link: '/ess/dashboard' })) });
    return a;
  }

  async updateAnnouncement(companyId: string, id: string, dto: UpdateAnnouncementDto) {
    if (!(await this.prisma.announcement.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Announcement not found');
    const { publishAt, expiresAt, ...rest } = dto;
    return this.prisma.announcement.update({
      where: { id },
      data: { ...rest, ...(publishAt ? { publishAt: new Date(publishAt) } : {}), ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}) },
    });
  }

  async deleteAnnouncement(companyId: string, id: string) {
    if (!(await this.prisma.announcement.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { ok: true };
  }

  // ---- policies ----
  async policies(user: AuthUser, includeInactive = false) {
    const rows = await this.prisma.policy.findMany({
      where: { companyId: user.companyId, ...(includeInactive ? {} : { isActive: true }) }, orderBy: [{ category: 'asc' }, { title: 'asc' }],
      include: { acknowledgements: user.employeeId ? { where: { employeeId: user.employeeId } } : false, _count: { select: { acknowledgements: true } } },
    });
    return rows.map((p) => ({
      id: p.id, title: p.title, category: p.category, content: p.content, version: p.version, isActive: p.isActive, updatedAt: p.updatedAt,
      acknowledged: Array.isArray(p.acknowledgements) && p.acknowledgements.some((a) => a.policyVersion === p.version), acknowledgedCount: p._count.acknowledgements,
    }));
  }

  createPolicy(companyId: string, dto: PolicyDto) {
    return this.prisma.policy.create({ data: { companyId, title: dto.title, category: dto.category || 'General', content: dto.content, isActive: dto.isActive ?? true } });
  }

  async updatePolicy(companyId: string, id: string, dto: UpdatePolicyDto) {
    const p = await this.prisma.policy.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Policy not found');
    // Content change publishes a new version that employees must re-acknowledge
    const bump = dto.content !== undefined && dto.content !== p.content;
    return this.prisma.policy.update({ where: { id }, data: { ...dto, ...(bump ? { version: p.version + 1 } : {}) } });
  }

  async acknowledge(user: AuthUser, id: string) {
    if (!user.employeeId) throw new BadRequestException('No employee profile');
    const p = await this.prisma.policy.findFirst({ where: { id, companyId: user.companyId, isActive: true } });
    if (!p) throw new NotFoundException('Policy not found');
    await this.prisma.policyAcknowledgement.upsert({
      where: { policyId_employeeId_policyVersion: { policyId: id, employeeId: user.employeeId, policyVersion: p.version } },
      create: { policyId: id, employeeId: user.employeeId, policyVersion: p.version }, update: {},
    });
    return { ok: true };
  }

  async acknowledgementStatus(companyId: string, id: string) {
    const p = await this.prisma.policy.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Policy not found');
    const [emps, acks] = await Promise.all([
      this.prisma.employee.findMany({ where: { companyId, status: 'ACTIVE' }, select: { id: true, employeeCode: true, firstName: true, lastName: true } }),
      this.prisma.policyAcknowledgement.findMany({ where: { policyId: id, policyVersion: p.version } }),
    ]);
    const done = new Map(acks.map((a) => [a.employeeId, a.acknowledgedAt]));
    return emps.map((e) => ({ employeeId: e.id, employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), acknowledgedAt: done.get(e.id) ?? null }));
  }
}
