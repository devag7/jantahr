import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { runExclusive } from '../../common/utils/cron-lock';
import { inProcessJobs } from '../../common/utils/jobs-mode';
import { PrismaService } from '../../prisma/prisma.service';
import { ErasureService } from './erasure.service';

const DAY = 86_400_000;

/** Data minimisation: drop credentials and notifications that no longer serve a purpose and anonymise stale job applicants (the careers page promises 12 months). Statutory employee records are never touched here. */
@Injectable()
export class PrivacyHousekeepingService {
  private readonly logger = new Logger(PrivacyHousekeepingService.name);
  constructor(private prisma: PrismaService, private erasure: ErasureService) {}

  @Cron('45 2 * * *', { timeZone: 'Asia/Kolkata' })
  async nightly() {
    if (!inProcessJobs()) return;
    await this.run();
  }

  async run() {
    return runExclusive(this.prisma, 'privacy-housekeeping', () => this.sweep()).catch((e) => this.logger.error(`housekeeping failed: ${e.message}`));
  }

  async sweep(now = new Date()) {
    const applicants = await this.erasure.purgeApplicants(this.erasure.applicantRetentionMonths);
    // Sessions and reset links live in Supabase Auth, which expires them itself.
    const notes = await this.prisma.notification.deleteMany({ where: { isRead: true, createdAt: { lt: new Date(now.getTime() - 180 * DAY) } } });
    this.logger.log(`housekeeping: ${notes.count} notifications removed, ${applicants} applicants anonymised`);
    return { notifications: notes.count, applicants };
  }
}
