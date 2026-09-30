import { BadRequestException, ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { errorMessage } from '../../common/utils/errors';

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;
/** Supabase bans are durations; a century is "until HR reactivates". */
const BAN_FOREVER = '876000h';

/**
 * Supabase Auth administration. Supabase Auth is JantaHR's only identity provider: it holds passwords, sessions,
 * email links, Google sign-in and TOTP factors. JantaHR keeps the authorisation side (company, role, employee) in
 * its own `User` row, linked by `authId` = the Supabase user id.
 */
@Injectable()
export class IdentityService implements OnModuleInit {
  private readonly logger = new Logger(IdentityService.name);
  private admin!: SupabaseClient;

  constructor(private supabase: SupabaseService, private prisma: PrismaService) {}

  onModuleInit() {
    if (!this.supabase.url || !this.supabase.anonKey || !this.supabase.adminKey) {
      throw new Error('Supabase Auth is required: set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (see .env.example)');
    }
    this.admin = createClient(this.supabase.url, this.supabase.adminKey, NO_SESSION);
  }

  private fail(action: string, error: { message?: string; code?: string; status?: number } | null): never {
    this.logger.warn(`Supabase Auth ${action} failed: ${error?.code ?? ''} ${error?.message ?? ''}`);
    if (error?.code === 'weak_password' || error?.status === 422) throw new BadRequestException(error?.message || `Could not ${action}`);
    throw new BadRequestException(`Could not ${action}. Try again.`);
  }

  /**
   * Creates the sign-in account for a new JantaHR user with a temporary password (email confirmed: the employer
   * vouches for work addresses). An existing Supabase account that no JantaHR user is linked to (an orphan from an
   * interrupted create, or an old self-signup that never finished) is taken over: its password is replaced, its
   * factors removed and its sessions ended, so only the new credentials work.
   */
  async createUser(email: string, password: string): Promise<string> {
    const { data, error } = await this.admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (!error) return data.user.id;
    if (error.code !== 'email_exists' && !/already been registered/i.test(error.message)) this.fail('create the sign-in account', error);
    const existing = await this.findByEmail(email);
    if (!existing) this.fail('create the sign-in account', error);
    if (await this.prisma.user.findUnique({ where: { authId: existing.id } })) throw new ConflictException('A user with this email already exists');
    await this.setPassword(existing.id, password);
    for (const f of await this.factors(existing.id)) await this.admin.auth.admin.mfa.deleteFactor({ userId: existing.id, id: f.id });
    await this.revokeSessions(existing.id);
    return existing.id;
  }

  async findByEmail(email: string) {
    const target = email.toLowerCase();
    for (let page = 1; page < 1000; page++) {
      const { data, error } = await this.admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return this.fail('look up the sign-in account', error);
      const users = data.users as SupabaseUser[];
      const hit = users.find((u) => u.email?.toLowerCase() === target);
      if (hit || users.length < 200) return hit ?? null;
    }
    return null;
  }

  async setPassword(authId: string, password: string) {
    const { error } = await this.admin.auth.admin.updateUserById(authId, { password });
    if (error) this.fail('set the password', error);
  }

  async setEmail(authId: string, email: string) {
    const { error } = await this.admin.auth.admin.updateUserById(authId, { email, email_confirm: true });
    if (error) this.fail('change the sign-in email', error);
  }

  async setBanned(authId: string, banned: boolean) {
    const { error } = await this.admin.auth.admin.updateUserById(authId, { ban_duration: banned ? BAN_FOREVER : 'none' });
    if (error) this.fail(banned ? 'disable sign-in' : 'enable sign-in', error);
  }

  async deleteUser(authId: string) {
    const { error } = await this.admin.auth.admin.deleteUser(authId);
    if (error && error.status !== 404) this.fail('delete the sign-in account', error);
  }

  async factors(authId: string) {
    const { data, error } = await this.admin.auth.admin.mfa.listFactors({ userId: authId });
    if (error) return this.fail('read two-factor settings', error);
    return data.factors;
  }

  async hasVerifiedFactor(authId: string) {
    return (await this.factors(authId)).some((f) => f.status === 'verified');
  }

  /** Checks a password without keeping the session it creates. */
  async checkPassword(email: string, password: string): Promise<boolean> {
    const client = createClient(this.supabase.url!, this.supabase.anonKey!, NO_SESSION);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return false;
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return true;
  }

  /**
   * Ends Supabase sessions (refresh tokens) for a user, optionally keeping one. Supabase has no admin endpoint for
   * this, so it deletes rows in `auth.sessions` directly when the API shares the Supabase database (both editions);
   * the auth guard's `sessionsRevokedAt` cut-off covers access tokens that are still unexpired either way.
   */
  async revokeSessions(authId: string, keepSessionId?: string) {
    try {
      const exists = await this.prisma.$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('auth.sessions') IS NOT NULL AS ok`;
      if (!exists[0]?.ok) return;
      if (keepSessionId) await this.prisma.$executeRaw`DELETE FROM auth.sessions WHERE user_id = ${authId}::uuid AND id <> ${keepSessionId}::uuid`;
      else await this.prisma.$executeRaw`DELETE FROM auth.sessions WHERE user_id = ${authId}::uuid`;
    } catch (e) {
      this.logger.warn(`Could not end Supabase sessions for ${authId}: ${errorMessage(e)}`);
    }
  }
}
