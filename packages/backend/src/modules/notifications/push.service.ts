import { createSign } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushInput { title: string; message: string; link?: string | null; id?: string }

interface ServiceAccount { project_id: string; client_email: string; private_key: string }

/** The FCM v1 message for one phone: a heads-up notification on the app's "updates" channel, plus where to open. */
export function fcmMessage(token: string, input: PushInput) {
  return {
    message: {
      token,
      notification: { title: input.title.slice(0, 120), body: input.message.slice(0, 400) },
      data: { link: input.link ?? '', id: input.id ?? '' },
      android: { priority: 'HIGH', notification: { channel_id: 'updates', color: '#2350E8' } },
    },
  };
}

/** FCM's answer for a token that will never work again (app uninstalled, data cleared, token rotated). */
export function isDeadToken(status: number, body: { error?: { status?: string; details?: { errorCode?: string }[] } }) {
  const code = body.error?.details?.find((d) => d.errorCode)?.errorCode;
  return status === 404 || code === 'UNREGISTERED' || (status === 400 && code === 'INVALID_ARGUMENT');
}

/**
 * Push notifications to the Android app through Firebase Cloud Messaging (HTTP v1), signed with the service account in
 * FCM_SERVICE_ACCOUNT_JSON. Without it pushes are skipped: the in-app list and email still carry every notification.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly account: ServiceAccount | null;
  private token: { value: string; until: number } | null = null;

  constructor(config: ConfigService, private prisma: PrismaService) {
    const raw = config.get<string>('FCM_SERVICE_ACCOUNT_JSON');
    let account: ServiceAccount | null = null;
    if (raw) {
      try { account = JSON.parse(raw) as ServiceAccount; } catch { this.logger.error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON: push notifications are off'); }
    }
    this.account = account?.project_id && account.client_email && account.private_key ? account : null;
  }

  get enabled() { return !!this.account; }

  /** Sends to every phone of the user; tokens FCM rejects for good are forgotten. Never throws. */
  async toUser(userId: string, input: PushInput) {
    if (!this.account) return;
    try {
      const devices = await this.prisma.pushDevice.findMany({ where: { userId }, select: { token: true } });
      if (!devices.length) return;
      const access = await this.accessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`;
      await Promise.all(devices.map(async ({ token }) => {
        const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: JSON.stringify(fcmMessage(token, input)) });
        if (res.ok) return;
        const body = await res.json().catch(() => ({}));
        if (isDeadToken(res.status, body)) await this.prisma.pushDevice.deleteMany({ where: { token } });
        else this.logger.warn(`FCM refused a push (${res.status} ${body.error?.status ?? ''})`);
      }));
    } catch (e) {
      this.logger.warn(`Push not sent: ${(e as Error).message}`);
    }
  }

  /** OAuth access token for FCM from the service account (a signed JWT), reused until shortly before it expires. */
  private async accessToken() {
    if (this.token && Date.now() < this.token.until) return this.token.value;
    const a = this.account!;
    const now = Math.floor(Date.now() / 1000);
    const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(a.private_key, 'base64url');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    });
    if (!res.ok) throw new Error(`Google refused the FCM service account (${res.status})`);
    const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: access_token, until: Date.now() + (expires_in - 300) * 1000 };
    return access_token;
  }
}
