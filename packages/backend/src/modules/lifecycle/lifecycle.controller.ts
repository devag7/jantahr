import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ADMIN_ROLES, APPROVER_ROLES, AuthUser, PAYROLL_ROLES, READ_ALL_ROLES } from '../../common/types';
import {
  ClearanceUpdateDto, ExitInterviewDto, FnfDto, InitiateSeparationDto, OnboardingTemplateDto, ResignDto, SeparationDecisionDto, TaskUpdateDto, UpdateOnboardingTemplateDto,
} from './lifecycle.dto';
import { OnboardingService } from './onboarding.service';
import { SeparationService } from './separation.service';

@RequiresFeature('lifecycle')
@Controller('lifecycle')
export class LifecycleController {
  constructor(private onboarding: OnboardingService, private separations: SeparationService) {}

  // ---- onboarding ----
  @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES) @Get('onboarding-templates') templates(@CurrentUser() u: AuthUser) { return this.onboarding.templates(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('onboarding-templates') createTemplate(@CurrentUser() u: AuthUser, @Body() dto: OnboardingTemplateDto) { return this.onboarding.createTemplate(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('onboarding-templates/:id') updateTemplate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateOnboardingTemplateDto) { return this.onboarding.updateTemplate(u.companyId, id, dto); }

  @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES) @Get('onboarding') listOnboarding(@CurrentUser() u: AuthUser, @Query('all') all?: string) { return this.onboarding.list(u.companyId, all === 'true'); }
  @Roles(...ADMIN_ROLES) @Post('onboarding/:employeeId/start') startOnboarding(@CurrentUser() u: AuthUser, @Param('employeeId') employeeId: string) { return this.onboarding.startFor(employeeId, u.companyId); }
  @Get('onboarding/employee/:employeeId') getOnboarding(@CurrentUser() u: AuthUser, @Param('employeeId') employeeId: string) { return this.onboarding.getForEmployee(u, employeeId); }
  @Patch('onboarding/tasks/:taskId') updateTask(@CurrentUser() u: AuthUser, @Param('taskId') taskId: string, @Body() dto: TaskUpdateDto) { return this.onboarding.updateTask(u, taskId, dto.status, dto.remarks); }
  @Roles(...ADMIN_ROLES) @Post('onboarding/remind') remind(@CurrentUser() u: AuthUser) { return this.onboarding.remind(u.companyId); }

  // ---- separation ----
  @Post('resign') resign(@CurrentUser() u: AuthUser, @Body() dto: ResignDto) { return this.separations.resign(u, dto); }
  @Roles(...ADMIN_ROLES) @Post('separations') initiate(@CurrentUser() u: AuthUser, @Body() dto: InitiateSeparationDto) { return this.separations.initiate(u, dto); }
  @Get('separations') list(@CurrentUser() u: AuthUser) { return this.separations.list(u); }
  @Get('separations/:id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.separations.getOne(u, id); }
  @Roles(...APPROVER_ROLES) @Post('separations/:id/approve') approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SeparationDecisionDto) { return this.separations.decide(u, id, true, dto); }
  @Roles(...APPROVER_ROLES) @Post('separations/:id/reject') reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SeparationDecisionDto) { return this.separations.decide(u, id, false, dto); }
  @Roles(...ADMIN_ROLES) @Patch('clearances/:id') clearance(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ClearanceUpdateDto) { return this.separations.updateClearance(u, id, dto); }
  @Roles(...ADMIN_ROLES) @Post('separations/:id/exit-interview') exitInterview(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ExitInterviewDto) { return this.separations.exitInterview(u, id, dto.notes); }
  @Roles(...PAYROLL_ROLES) @Post('separations/:id/fnf') fnf(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: FnfDto) { return this.separations.computeFnf(u, id, dto); }
  @Roles(...PAYROLL_ROLES) @Post('separations/:id/fnf/approve') approveFnf(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.separations.approveFnf(u, id); }
  @Roles(...ADMIN_ROLES) @Post('separations/:id/complete') complete(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.separations.complete(u, id); }

  @Roles(...ADMIN_ROLES)
  @Get('separations/:id/letter')
  async letter(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('type') type: string, @Res() res: Response) {
    const { buffer, filename } = await this.separations.letter(u, id, type === 'experience' ? 'experience' : 'relieving');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
