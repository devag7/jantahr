import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../types';
import { CONSENT_PURPOSES, ConsentPurpose, ConsentState, NOTICE_VERSION, isConsentPurpose, resolveConsents } from './consent-rules';

@Injectable()
export class ConsentService {
  constructor(private prisma: PrismaService) {}

  async statusFor(userId: string) {
    const rows = await this.prisma.consentRecord.findMany({ where: { userId }, select: { purpose: true, granted: true, noticeVersion: true, createdAt: true } });
    return resolveConsents(rows);
  }

  /** True unless the person has explicitly withdrawn this purpose. Enforcement points call this before collecting or sharing data. */
  async isAllowed(userId: string, purpose: ConsentPurpose): Promise<boolean> {
    const latest = await this.prisma.consentRecord.findFirst({ where: { userId, purpose }, orderBy: { createdAt: 'desc' }, select: { granted: true } });
    return latest ? latest.granted : true;
  }

  async list(user: AuthUser) {
    const status = await this.statusFor(user.userId);
    return {
      noticeVersion: NOTICE_VERSION,
      purposes: (Object.keys(CONSENT_PURPOSES) as ConsentPurpose[]).map((purpose) => ({ purpose, ...CONSENT_PURPOSES[purpose], ...status[purpose] })),
    };
  }

  async set(user: AuthUser, purpose: string, granted: boolean, ip?: string) {
    if (!isConsentPurpose(purpose)) throw new BadRequestException('Unknown consent purpose');
    if (CONSENT_PURPOSES[purpose].required && !granted) throw new BadRequestException('The privacy notice is required for employment records and cannot be withdrawn here. Raise an erasure or grievance request instead.');
    await this.prisma.consentRecord.create({ data: { companyId: user.companyId, userId: user.userId, purpose, noticeVersion: NOTICE_VERSION, granted, ipAddress: ip?.slice(0, 60) } });
    return this.list(user);
  }

  /** Current state of every purpose for reporting (admin view). */
  async summary(companyId: string): Promise<Record<ConsentPurpose, Record<ConsentState, number>>> {
    const users = await this.prisma.user.count({ where: { companyId, isActive: true } });
    const rows = await this.prisma.consentRecord.findMany({ where: { companyId }, select: { userId: true, purpose: true, granted: true, noticeVersion: true, createdAt: true } });
    const byUser = new Map<string, typeof rows>();
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    const out = {} as Record<ConsentPurpose, Record<ConsentState, number>>;
    for (const p of Object.keys(CONSENT_PURPOSES) as ConsentPurpose[]) out[p] = { GRANTED: 0, WITHDRAWN: 0, NOT_ASKED: 0, OUTDATED: 0 };
    for (const [, r] of byUser) {
      const s = resolveConsents(r);
      for (const p of Object.keys(s) as ConsentPurpose[]) out[p][s[p].state]++;
    }
    for (const p of Object.keys(out) as ConsentPurpose[]) out[p].NOT_ASKED = Math.max(0, users - out[p].GRANTED - out[p].WITHDRAWN - out[p].OUTDATED);
    return out;
  }
}
