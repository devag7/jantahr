import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../notifications/mail.service';
import { ContactDto, ContactTopic } from './contact.dto';

const TOPIC_LABEL: Record<ContactTopic, string> = { sales: 'Sales', billing: 'Billing', support: 'Help with my account', privacy: 'Privacy', other: 'Other' };

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The email the business receives for one contact-form message. Pure, so the tests can read it. */
export function contactEmail(dto: ContactDto, receivedAt: Date) {
  const rows: [string, string | undefined][] = [
    ['Name', dto.name], ['Email', dto.email], ['Company', dto.company], ['Phone', dto.phone], ['Topic', TOPIC_LABEL[dto.topic]],
    ['Received', receivedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })],
  ];
  const subject = `[JantaHR contact] ${TOPIC_LABEL[dto.topic]}: ${dto.name}${dto.company ? `, ${dto.company}` : ''}`.slice(0, 200);
  const html = `<table cellpadding="4">${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${escape(v!)}</td></tr>`).join('')}</table>`
    + `<p style="white-space:pre-wrap">${escape(dto.message)}</p><p>Reply to this email to answer ${escape(dto.name)} directly.</p>`;
  return { subject, html };
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  constructor(private config: ConfigService, private mail: MailService) {}

  /** Mails the message to the business's support address, with Reply-To set to the sender. */
  async send(dto: ContactDto): Promise<{ ok: true }> {
    // a filled honeypot is a bot: accept quietly so it learns nothing, send nothing
    if (dto.website) return { ok: true };
    const to = this.config.get<string>('SUPPORT_EMAIL');
    if (!to || !this.mail.delivers) {
      this.logger.warn('Contact form used but SUPPORT_EMAIL or SMTP is not configured');
      throw new ServiceUnavailableException({ message: 'The contact form is not available on this server. Please write to us by email.', code: 'CONTACT_UNAVAILABLE' });
    }
    const { subject, html } = contactEmail(dto, new Date());
    try {
      await this.mail.send(to, subject, html, undefined, { replyTo: dto.email, throwOnError: true });
    } catch {
      throw new ServiceUnavailableException({ message: 'Your message could not be sent just now. Please try again, or write to us by email.', code: 'CONTACT_FAILED' });
    }
    return { ok: true };
  }
}
