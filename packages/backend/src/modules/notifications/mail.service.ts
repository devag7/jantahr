import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { errorMessage } from '../../common/utils/errors';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM') || 'JantaHR <no-reply@jantahr.com>';
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(config.get('SMTP_PORT') || 587),
        secure: config.get('SMTP_SECURE') === 'true',
        auth: config.get('SMTP_USER') ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') } : undefined,
      });
    } else {
      this.logger.warn('SMTP_HOST not configured: emails are written to the log instead of being sent');
    }
  }

  /** Whether mail actually leaves the server (SMTP configured), rather than being written to the log. */
  get delivers(): boolean { return !!this.transporter; }

  /**
   * Sends one email. A failure is logged and swallowed, so a notification never breaks the action that caused it;
   * pass `throwOnError` when the caller must tell the person the message did not go (the contact form).
   */
  async send(to: string, subject: string, html: string, attachments?: { filename: string; content: Buffer }[], options: { replyTo?: string; throwOnError?: boolean } = {}): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[mail:dev] to=${to} subject="${subject}" ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, attachments, ...(options.replyTo ? { replyTo: options.replyTo } : {}) });
    } catch (e) {
      this.logger.error(`mail to ${to} failed: ${errorMessage(e)}`);
      if (options.throwOnError) throw e;
    }
  }
}
