import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import * as multer from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MAX_UPLOAD_BYTES, StorageService } from '../../common/storage/storage.service';
import { SignUploadDto } from '../../common/storage/uploads.controller';
import { ADMIN_ROLES, AuthUser, READ_ALL_ROLES } from '../../common/types';
import { ApplyDto, HireDto, InterviewDto, InterviewFeedbackDto, JobDto, OfferDto, RecruitmentService, StageDto, UpdateJobDto } from './recruitment.service';

@RequiresFeature('recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(private service: RecruitmentService, private storage: StorageService) {}

  @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES) @Get('jobs') jobs(@CurrentUser() u: AuthUser, @Query('status') status?: string) { return this.service.jobs(u.companyId, status); }
  @Roles(...ADMIN_ROLES) @Post('jobs') createJob(@CurrentUser() u: AuthUser, @Body() dto: JobDto) { return this.service.createJob(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('jobs/:id') updateJob(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateJobDto) { return this.service.updateJob(u.companyId, id, dto); }

  @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES) @Get('applicants') applicants(@CurrentUser() u: AuthUser, @Query('jobId') jobId?: string, @Query('stage') stage?: string) { return this.service.applicants(u.companyId, jobId, stage); }
  @Roles(...ADMIN_ROLES) @Patch('applicants/:id/stage') stage(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: StageDto) { return this.service.moveStage(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Get('funnel') funnel(@CurrentUser() u: AuthUser, @Query('jobId') jobId?: string) { return this.service.funnel(u.companyId, jobId); }

  @Roles(...ADMIN_ROLES)
  @Get('applicants/:id/resume')
  async resume(@CurrentUser() u: AuthUser, @Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const { key, name } = await this.service.downloadResume(u.companyId, id);
    await this.storage.send(req, res, key, name);
  }

  @Roles(...ADMIN_ROLES) @Post('interviews') schedule(@CurrentUser() u: AuthUser, @Body() dto: InterviewDto) { return this.service.scheduleInterview(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('interviews/:id') feedback(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: InterviewFeedbackDto) { return this.service.interviewFeedback(u.companyId, id, dto); }

  @Roles(...ADMIN_ROLES) @Post('offers') offer(@CurrentUser() u: AuthUser, @Body() dto: OfferDto) { return this.service.createOffer(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Post('offers/:id/accept') accept(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.respondOffer(u.companyId, id, true); }
  @Roles(...ADMIN_ROLES) @Post('offers/:id/decline') decline(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.respondOffer(u.companyId, id, false); }
  @Roles(...ADMIN_ROLES) @Post('hire') hire(@CurrentUser() u: AuthUser, @Body() dto: HireDto) { return this.service.hire(u, dto); }
}

/** Unauthenticated career-page API. */
@Controller('public/careers')
export class PublicCareersController {
  constructor(private service: RecruitmentService) {}

  @Public() @Get('company/:companyId') jobs(@Param('companyId') companyId: string) { return this.service.publicJobs(companyId); }
  @Public() @Get('jobs/:slug') job(@Param('slug') slug: string) { return this.service.publicJob(slug); }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Post('jobs/:slug/apply')
  @UseInterceptors(FileInterceptor('resume', { storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  apply(@Param('slug') slug: string, @Body() dto: ApplyDto, @UploadedFile() resume?: Express.Multer.File, @Body('upload') ticket?: string) {
    return this.service.apply(slug, dto, resume, ticket);
  }

  /** Presigned résumé upload for the cloud edition, where request bodies are capped at 4.5 MB. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @Post('jobs/:slug/resume-upload')
  signResume(@Param('slug') slug: string, @Body() dto: SignUploadDto) {
    return this.service.signResumeUpload(slug, dto);
  }
}
