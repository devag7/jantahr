import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { ConsentService } from '../../common/consent/consent.service';
import { NOTICE_VERSION } from '../../common/consent/consent-rules';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessService } from '../../common/access/access.service';
import { ADMIN_ROLES, AuthUser } from '../../common/types';
import { BreachService } from './breach.service';
import { DataExportService } from './data-export.service';
import { ErasureService } from './erasure.service';
import { PrivacyHousekeepingService } from './privacy-housekeeping.service';
import { PrivacyRequestsService } from './privacy-requests.service';
import { AnonymiseApplicantsDto, BreachDto, BreachUpdateDto, ConsentDto, EraseDto, PrivacyRequestDto, PrivacyRequestUpdateDto } from './privacy.dto';

import { Request } from 'express';
const AUDIT_ROLES: Role[] = [...ADMIN_ROLES, Role.AUDITOR];

@Controller('privacy')
export class PrivacyController {
  constructor(
    private consent: ConsentService, private requests: PrivacyRequestsService, private breaches: BreachService, private exporter: DataExportService,
    private erasure: ErasureService, private housekeeping: PrivacyHousekeepingService, private access: AccessService,
  ) {}

  // --- everyone: consent, own data, own requests ---
  @Get('consents') consents(@CurrentUser() u: AuthUser) { return this.consent.list(u); }
  @Put('consents/:purpose') setConsent(@CurrentUser() u: AuthUser, @Param('purpose') purpose: string, @Body() dto: ConsentDto, @Req() req: Request) { return this.consent.set(u, purpose, dto.granted, req.ip); }

  @Get('my-data')
  async myData(@CurrentUser() u: AuthUser, @Res({ passthrough: true }) res: Response) {
    const data = await this.exporter.build(u, this.access.requireEmployee(u), 'SELF_SERVICE');
    res.setHeader('Content-Disposition', `attachment; filename="my-personal-data-${new Date().toISOString().slice(0, 10)}.json"`);
    return data;
  }

  @Post('requests') createRequest(@CurrentUser() u: AuthUser, @Body() dto: PrivacyRequestDto) { return this.requests.create(u, dto); }
  @Get('requests/mine') myRequests(@CurrentUser() u: AuthUser) { return this.requests.mine(u); }

  // --- HR: request queue, per-person export, retention and erasure ---
  @Roles(...ADMIN_ROLES, Role.AUDITOR) @Get('requests') allRequests(@CurrentUser() u: AuthUser, @Query('status') status?: string) { return this.requests.list(u, status); }
  @Roles(...ADMIN_ROLES) @Patch('requests/:id') updateRequest(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: PrivacyRequestUpdateDto) { return this.requests.update(u, id, dto); }

  @Roles(...ADMIN_ROLES) @Get('export/:employeeId')
  async exportFor(@CurrentUser() u: AuthUser, @Param('employeeId') employeeId: string, @Res({ passthrough: true }) res: Response) {
    const data = await this.exporter.build(u, employeeId, 'ADMIN_ACCESS_REQUEST');
    res.setHeader('Content-Disposition', `attachment; filename="personal-data-${data._meta.employeeCode}.json"`);
    return data;
  }

  @Roles(...AUDIT_ROLES) @Get('overview')
  async overview(@CurrentUser() u: AuthUser) {
    const [consents, retention, applicants] = await Promise.all([this.consent.summary(u.companyId), this.erasure.retentionReport(u.companyId), this.erasure.eligibleApplicants(u.companyId)]);
    return { noticeVersion: NOTICE_VERSION, consents, retention: retention.summary, retentionYears: retention.retentionYears, applicantsDue: applicants };
  }
  @Roles(...AUDIT_ROLES) @Get('retention') retention(@CurrentUser() u: AuthUser, @Query('years') years?: string) { return this.erasure.retentionReport(u.companyId, years ? Number(years) : undefined); }
  @Roles(...ADMIN_ROLES) @Post('erase/:employeeId') erase(@CurrentUser() u: AuthUser, @Param('employeeId') employeeId: string, @Body() dto: EraseDto) { return this.erasure.erase(u, employeeId, dto); }
  @Roles(...ADMIN_ROLES) @Post('applicants/anonymise') anonymiseApplicants(@CurrentUser() u: AuthUser, @Body() dto: AnonymiseApplicantsDto) { return this.erasure.anonymiseApplicants(u, dto); }
  @Roles(Role.SUPER_ADMIN) @Post('housekeeping/run') runHousekeeping() { return this.housekeeping.sweep(); }

  // --- breach register ---
  @Roles(...AUDIT_ROLES) @Get('breaches') listBreaches(@CurrentUser() u: AuthUser) { return this.breaches.list(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('breaches') createBreach(@CurrentUser() u: AuthUser, @Body() dto: BreachDto) { return this.breaches.create(u, dto); }
  @Roles(...ADMIN_ROLES) @Patch('breaches/:id') updateBreach(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: BreachUpdateDto) { return this.breaches.update(u, id, dto); }
  @Roles(...ADMIN_ROLES) @Post('breaches/:id/notify-employees') notifyBreach(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.breaches.notifyEmployees(u, id); }
}
