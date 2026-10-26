import 'reflect-metadata';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { DeviceDto } from './notifications.dto';
import { PushService, fcmMessage, isDeadToken } from './push.service';

const TOKEN = 'fcm-token-'.padEnd(160, 'x');

describe('fcmMessage', () => {
  it('sends a heads-up notification on the updates channel with the link to open', () => {
    const m = fcmMessage(TOKEN, { title: 'Leave approved', message: 'Your Casual Leave was approved', link: '/me/leave', id: 'n1' });
    expect(m.message.token).toBe(TOKEN);
    expect(m.message.notification).toEqual({ title: 'Leave approved', body: 'Your Casual Leave was approved' });
    expect(m.message.data).toEqual({ link: '/me/leave', id: 'n1' });
    expect(m.message.android).toEqual({ priority: 'HIGH', notification: { channel_id: 'updates', color: '#2350E8' } });
  });
  it('keeps data values as strings (FCM rejects null) and trims long text', () => {
    const m = fcmMessage(TOKEN, { title: 't'.repeat(200), message: 'm'.repeat(600), link: null });
    expect(m.message.data).toEqual({ link: '', id: '' });
    expect(m.message.notification.title).toHaveLength(120);
    expect(m.message.notification.body).toHaveLength(400);
  });
});

describe('isDeadToken', () => {
  it('forgets tokens FCM says are gone, keeps them on other failures', () => {
    expect(isDeadToken(404, {})).toBe(true);
    expect(isDeadToken(400, { error: { details: [{ errorCode: 'INVALID_ARGUMENT' }] } })).toBe(true);
    expect(isDeadToken(403, { error: { details: [{ errorCode: 'UNREGISTERED' }] } })).toBe(true);
    expect(isDeadToken(500, { error: { status: 'INTERNAL' } })).toBe(false);
    expect(isDeadToken(429, { error: { details: [{ errorCode: 'QUOTA_EXCEEDED' }] } })).toBe(false);
  });
});

describe('PushService', () => {
  const prisma = { pushDevice: { findMany: jest.fn(), deleteMany: jest.fn() } };
  const make = (json?: string) => new PushService({ get: () => json } as unknown as ConfigService, prisma as never);
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.resetAllMocks(); });

  it('is off without a service account, and never touches the database', async () => {
    const push = make(undefined);
    expect(push.enabled).toBe(false);
    await push.toUser('u1', { title: 'x', message: 'y' });
    expect(prisma.pushDevice.findMany).not.toHaveBeenCalled();
    expect(make('not json').enabled).toBe(false);
  });

  it('signs a JWT for FCM, sends to each phone and forgets dead tokens', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const account = { project_id: 'jantahr-play', client_email: 'fcm@jantahr-play.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
    prisma.pushDevice.findMany.mockResolvedValue([{ token: 'good'.padEnd(40, 'g') }, { token: 'gone'.padEnd(40, 'x') }]);
    const calls: { url: string; body: string; auth?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body), auth: (init.headers as Record<string, string>).Authorization });
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }));
      if (String(init.body).includes('gone')) return new Response(JSON.stringify({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
      return new Response('{}');
    }) as never;

    await make(JSON.stringify(account)).toUser('u1', { title: 'Payslip ready', message: 'Your September payslip is ready', link: '/me/payslips' });

    const assertion = new URLSearchParams(calls[0].body).get('assertion')!;
    const [h, c, sig] = assertion.split('.');
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, sig, 'base64url')).toBe(true);
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toMatchObject({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging' });
    const sends = calls.filter((x) => x.url.includes('fcm.googleapis.com'));
    expect(sends).toHaveLength(2);
    expect(sends[0].url).toBe('https://fcm.googleapis.com/v1/projects/jantahr-play/messages:send');
    expect(sends[0].auth).toBe('Bearer ya29.test');
    expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { token: 'gone'.padEnd(40, 'x') } });
    expect(prisma.pushDevice.deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe('DeviceDto', () => {
  const errors = (body: object) => validateSync(plainToInstance(DeviceDto, body)).map((e) => e.property);
  it('takes an FCM token and an optional platform', () => {
    expect(errors({ token: TOKEN })).toEqual([]);
    expect(errors({ token: TOKEN, platform: 'android' })).toEqual([]);
    expect(errors({ token: 'short' })).toEqual(['token']);
    expect(errors({ token: TOKEN, platform: 'windows' })).toEqual(['platform']);
  });
});
