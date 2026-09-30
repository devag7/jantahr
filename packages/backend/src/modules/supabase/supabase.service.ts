import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { edition } from '../../common/edition/edition';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import * as crypto from 'crypto';
import { Jwk, JwtError, SupabaseClaims, verifySupabaseJwt } from './supabase-jwt';

import { errorMessage } from '../../common/utils/errors';
/**
 * Optional Supabase platform features (both editions: Supabase cloud, or the self-hosted stack in deploy/self-hosted):
 *  - Realtime Broadcast: after a notification is stored the API pings a per-user channel whose name is an HMAC the
 *    browser receives from the API; the ping carries no data, the browser refetches. Works with the new publishable /
 *    secret API keys and asymmetric JWT signing keys (no JWT minting needed).
 *  - Auth: Supabase Auth is the only identity provider; see modules/identity for the admin side and the auth guard.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  readonly url: string | null;
  readonly publicUrl: string | null;
  readonly anonKey: string | null;
  private readonly secretKey: string | null;
  private readonly jwtSecret: string | null;
  private readonly topicSecret: string;
  private jwks: { at: number; keys: Jwk[] } | null = null;

  constructor(config: ConfigService, private prisma: PrismaService, private storage: StorageService) {
    this.url = config.get<string>('SUPABASE_URL')?.replace(/\/$/, '') || null;
    this.publicUrl = config.get<string>('SUPABASE_PUBLIC_URL')?.replace(/\/$/, '') || this.url;
    // new key names first (sb_publishable_ / sb_secret_), legacy anon / service_role JWTs as fallback
    this.anonKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY') || config.get<string>('SUPABASE_ANON_KEY') || null;
    this.secretKey = config.get<string>('SUPABASE_SECRET_KEY') || config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || null;
    this.jwtSecret = config.get<string>('SUPABASE_JWT_SECRET') || null;
    this.topicSecret = config.get<string>('JWT_SECRET') || 'jantahr';
  }

  /** Re-apply RLS lock-down + Realtime policy at boot (idempotent) so tables from later migrations are covered. */
  async onModuleInit() {
    if (process.env.SUPABASE_HARDEN_ON_BOOT === 'false') return;
    try {
      await this.prisma.$executeRawUnsafe('SELECT public.jantahr_supabase_harden()');
    } catch (e) {
      this.logger.warn(`RLS hardening skipped: ${errorMessage(e)}`);
    }
  }

  get enabled() { return !!(this.url && this.anonKey); }
  /** Server-only admin key (sb_secret_… or legacy service_role). */
  get adminKey() { return this.secretKey; }
  get realtimeEnabled() { return this.enabled && !!this.secretKey; }

  runtime(googleSignIn: boolean) {
    return {
      edition: edition(),
      supabase: this.enabled ? { url: this.publicUrl, publishableKey: this.anonKey, realtime: this.realtimeEnabled } : null,
      googleSignIn: this.enabled && googleSignIn,
      directUploads: this.storage.directUploads,
    };
  }

  /** Unguessable per-user Broadcast channel (HMAC of the user id with the API's secret). */
  notificationTopic(userId: string) {
    const mac = crypto.createHmac('sha256', this.topicSecret).update(`notify:${userId}`).digest('base64url').slice(0, 32);
    return `notify-${mac}`;
  }

  /** Fire-and-forget ping so the user's open browser tabs refetch notifications. Never throws. */
  async pingUser(userId: string) {
    if (!this.realtimeEnabled) return;
    const key = this.secretKey!;
    const headers: Record<string, string> = { 'content-type': 'application/json', apikey: key };
    if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`; // legacy service_role JWT
    try {
      const res = await fetch(`${this.url}/realtime/v1/api/broadcast`, {
        method: 'POST', headers,
        body: JSON.stringify({ messages: [{ topic: this.notificationTopic(userId), event: 'notification', payload: {} }] }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) this.logger.warn(`Realtime broadcast failed: HTTP ${res.status}`);
    } catch (e) {
      this.logger.warn(`Realtime broadcast failed: ${errorMessage(e)}`);
    }
  }

  private async signingKeys(): Promise<Jwk[]> {
    if (this.jwks && Date.now() - this.jwks.at < 10 * 60_000) return this.jwks.keys;
    try {
      const res = await fetch(`${this.url}/auth/v1/.well-known/jwks.json`);
      const body = (await res.json()) as { keys?: Jwk[] };
      this.jwks = { at: Date.now(), keys: body.keys ?? [] };
    } catch (e) {
      this.logger.warn(`JWKS fetch failed: ${errorMessage(e)}`);
      this.jwks = { at: Date.now(), keys: [] };
    }
    return this.jwks.keys;
  }

  /** Verifies a Supabase Auth access token (HS256 legacy secret or asymmetric JWKS). */
  async verifyAccessToken(token: string): Promise<SupabaseClaims> {
    if (!this.enabled) throw new JwtError('Supabase is not configured');
    const alg = (() => { try { return JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString()).alg; } catch { return null; } })();
    return verifySupabaseJwt(token, {
      secret: this.jwtSecret ?? undefined,
      jwks: alg && alg !== 'HS256' ? await this.signingKeys() : undefined,
      issuer: `${this.publicUrl}/auth/v1`,
      audience: 'authenticated',
    });
  }
}
