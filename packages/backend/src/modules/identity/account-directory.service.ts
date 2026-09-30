import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface Account {
  userId: string; email: string; role: Role; companyId: string | null; employeeId: string | null;
  isActive: boolean; mfaEnabled: boolean; sessionsRevokedAt: number | null;
}

const TTL_MS = 30_000;
const LAST_LOGIN_EVERY_MS = 15 * 60_000;

/**
 * Maps a Supabase user id to the JantaHR account behind it, cached for 30 seconds per API instance. Anything that
 * changes role, status, MFA or sessions calls `forget` so the change applies on the next request here; other
 * instances pick it up within the TTL.
 */
@Injectable()
export class AccountDirectory {
  private cache = new Map<string, { at: number; account: Account | null }>();

  constructor(private prisma: PrismaService) {}

  async byAuthId(authId: string): Promise<Account | null> {
    const hit = this.cache.get(authId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.account;
    const u = await this.prisma.user.findUnique({ where: { authId }, include: { employee: { select: { id: true } } } });
    const account: Account | null = u && {
      userId: u.id, email: u.email, role: u.role, companyId: u.companyId, employeeId: u.employee?.id ?? null,
      isActive: u.isActive, mfaEnabled: u.mfaEnabled, sessionsRevokedAt: u.sessionsRevokedAt?.getTime() ?? null,
    };
    if (u && (!u.lastLogin || Date.now() - u.lastLogin.getTime() > LAST_LOGIN_EVERY_MS)) {
      await this.prisma.user.update({ where: { id: u.id }, data: { lastLogin: new Date() } }).catch(() => undefined);
    }
    this.cache.set(authId, { at: Date.now(), account });
    return account;
  }

  forget(authId?: string | null) {
    if (authId) this.cache.delete(authId);
  }
}
