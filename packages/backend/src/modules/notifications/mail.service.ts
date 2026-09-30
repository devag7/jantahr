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

  async send(to: string, subject: string, html: string, attachments?: { filename: string; content: Buffer }[]): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[mail:dev] to=${to} subject="${subject}" ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, attachments });
    } catch (e) {
      this.logger.error(`mail to ${to} failed: ${errorMessage(e)}`);
    }
  }
}
