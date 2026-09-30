import { Controller, Get, HttpCode, NotFoundException, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { runExclusive } from '../../common/utils/cron-lock';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { BillingService } from '../billing/billing.service';
import { LeaveAllocationService } from '../leave/leave-allocation.service';
import { PrivacyHousekeepingService } from '../privacy/privacy-housekeeping.service';

/**
 * Scheduled jobs over HTTP for serverless deployments. Callers:
 *  - Vercel Cron (GET with `Authorization: Bearer $CRON_SECRET`, see packages/backend/vercel.json)
 *  - Supabase pg_cron → Edge Function `jobs-dispatch` (POST, same header)
 * Every job is idempotent and takes a Postgres advisory lock, so overlapping triggers are harmless.
 */
@Public()
@SkipThrottle()
@Controller('internal/jobs')
export class JobsController {
  private readonly jobs: Record<string, () => Promise<unknown>>;

  constructor(
    private config: ConfigService, prisma: PrismaService, attendance: AttendanceService, leave: LeaveAllocationService,
    housekeeping: PrivacyHousekeepingService, billing: BillingService,
  ) {
    this.jobs = {
      'attendance-finalise': () => attendance.nightlyFinalise(),
      'leave-accrual': () => leave.monthlyAccrualJob(),
      'leave-rollover': () => leave.yearlyRolloverJob(),
      'privacy-housekeeping': () => housekeeping.run(),
      'billing-sweep': () => runExclusive(prisma, 'billing-sweep', () => billing.sweep()),
      'billing-inbox': () => billing.processInbox(),
    };
  }

  private authorise(req: Request) {
    const secret = this.config.get<string>('CRON_SECRET');
    const header = String(req.headers.authorization || '');
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!secret || secret.length < 16 || given.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }

  private async run(name: string, req: Request) {
    this.authorise(req);
    const job = this.jobs[name];
    if (!job) throw new NotFoundException(`Unknown job ${name}. Known: ${Object.keys(this.jobs).join(', ')}`);
    const started = Date.now();
    const result = await job();
    return { job: name, ok: true, ms: Date.now() - started, result: result ?? null };
  }

  @Get(':name') get(@Param('name') name: string, @Req() req: Request) { return this.run(name, req); }
  @Post(':name') @HttpCode(200) post(@Param('name') name: string, @Req() req: Request) { return this.run(name, req); }
}
