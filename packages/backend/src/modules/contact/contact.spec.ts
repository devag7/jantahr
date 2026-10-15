import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ContactDto } from './contact.dto';
import { ContactService, contactEmail } from './contact.service';

const valid = { name: 'Asha Rao', email: 'asha@example.in', company: 'Rao Textiles', phone: '+91 98765 43210', topic: 'sales', message: 'We have 40 employees in Pune and want to move payroll.' };
const errors = (body: object) => validateSync(plainToInstance(ContactDto, body)).map((e) => e.property);

describe('ContactDto', () => {
  it('accepts a complete message and trims it', () => {
    const dto = plainToInstance(ContactDto, { ...valid, name: '  Asha Rao  ' });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.name).toBe('Asha Rao');
  });
  it('needs a name, a real email, a known topic and a message of at least 10 characters', () => {
    expect(errors({ ...valid, name: 'A' })).toEqual(['name']);
    expect(errors({ ...valid, email: 'asha@' })).toEqual(['email']);
    expect(errors({ ...valid, topic: 'jobs' })).toEqual(['topic']);
    expect(errors({ ...valid, message: 'hi' })).toEqual(['message']);
    expect(errors({ ...valid, phone: 'call me' })).toEqual(['phone']);
  });
  it('treats company and phone as optional', () => {
    expect(errors({ name: valid.name, email: valid.email, topic: 'other', message: valid.message })).toEqual([]);
  });
});

describe('contactEmail', () => {
  it('escapes what the sender typed and names the topic in the subject', () => {
    const { subject, html } = contactEmail(plainToInstance(ContactDto, { ...valid, message: '<script>alert(1)</script> & more' }), new Date('2026-10-15T06:30:00Z'));
    expect(subject).toBe('[JantaHR contact] Sales: Asha Rao, Rao Textiles');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more');
    expect(html).not.toContain('<script>');
    expect(html).toContain('15 Oct 2026');
  });
});

describe('ContactService', () => {
  const make = (env: Record<string, string | undefined>, delivers = true, fail = false) => {
    const mail = { delivers, send: jest.fn(async () => { if (fail) throw new Error('smtp down'); }) };
    const config = { get: (k: string) => env[k] };
    return { service: new ContactService(config as never, mail as never), mail };
  };
  const dto = plainToInstance(ContactDto, valid);

  it('mails the support address with Reply-To set to the sender', async () => {
    const { service, mail } = make({ SUPPORT_EMAIL: 'jantahr@example.com' });
    await expect(service.send(dto)).resolves.toEqual({ ok: true });
    expect(mail.send).toHaveBeenCalledWith('jantahr@example.com', expect.stringContaining('Sales'), expect.any(String), undefined, { replyTo: 'asha@example.in', throwOnError: true });
  });
  it('answers a filled honeypot as if it worked and sends nothing', async () => {
    const { service, mail } = make({ SUPPORT_EMAIL: 'jantahr@example.com' });
    await expect(service.send(plainToInstance(ContactDto, { ...valid, website: 'http://spam' }))).resolves.toEqual({ ok: true });
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('says the form is unavailable when there is no address or no mail server', async () => {
    await expect(make({}).service.send(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(make({ SUPPORT_EMAIL: 'x@example.com' }, false).service.send(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('reports a failed send instead of claiming success', async () => {
    const { service } = make({ SUPPORT_EMAIL: 'jantahr@example.com' }, true, true);
    await expect(service.send(dto)).rejects.toMatchObject({ response: { code: 'CONTACT_FAILED' } });
  });
});
