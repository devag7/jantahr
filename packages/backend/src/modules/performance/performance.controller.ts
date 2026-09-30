import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ADMIN_ROLES, APPROVER_ROLES, AuthUser, PAYROLL_ROLES } from '../../common/types';
import { ApplyRevisionDto, CycleDto, GoalDto, HrFinalizeDto, LaunchDto, ManagerReviewDto, SelfReviewDto, UpdateCycleDto, UpdateGoalDto } from './performance.dto';
import { PerformanceService } from './performance.service';

@RequiresFeature('performance')
@Controller('performance')
export class PerformanceController {
  constructor(private service: PerformanceService) {}

  @Get('cycles') cycles(@CurrentUser() u: AuthUser) { return this.service.cycles(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('cycles') createCycle(@CurrentUser() u: AuthUser, @Body() dto: CycleDto) { return this.service.createCycle(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('cycles/:id') updateCycle(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateCycleDto) { return this.service.updateCycle(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Post('cycles/:id/launch') launch(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: LaunchDto) { return this.service.launch(u, id, dto.departmentId); }
  @Roles(...ADMIN_ROLES) @Get('cycles/:id/summary') summary(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.cycleSummary(u.companyId, id); }

  @Get('goals') goals(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string) { return this.service.goals(u, employeeId); }
  @Post('goals') createGoal(@CurrentUser() u: AuthUser, @Body() dto: GoalDto) { return this.service.createGoal(u, dto); }
  @Patch('goals/:id') updateGoal(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateGoalDto) { return this.service.updateGoal(u, id, dto); }
  @Roles(...APPROVER_ROLES) @Post('goals/:id/approve') approveGoal(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.decideGoal(u, id, true); }
  @Roles(...APPROVER_ROLES) @Post('goals/:id/reject') rejectGoal(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.decideGoal(u, id, false); }

  @Get('appraisals/mine') mine(@CurrentUser() u: AuthUser) { return this.service.myAppraisals(u); }
  @Roles(...APPROVER_ROLES) @Get('appraisals/pending') pending(@CurrentUser() u: AuthUser) { return this.service.pendingReviews(u); }
  @Roles(...ADMIN_ROLES, Role.MANAGER) @Get('appraisals/cycle/:cycleId') byCycle(@CurrentUser() u: AuthUser, @Param('cycleId') cycleId: string) { return this.service.appraisalsForCycle(u, cycleId); }
  @Get('appraisals/:id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.getOne(u, id); }
  @Post('appraisals/:id/self-review') self(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SelfReviewDto) { return this.service.selfReview(u, id, dto); }
  @Roles(...APPROVER_ROLES) @Post('appraisals/:id/manager-review') manager(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ManagerReviewDto) { return this.service.managerReview(u, id, dto); }
  @Roles(...ADMIN_ROLES) @Post('appraisals/:id/finalize') finalize(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: HrFinalizeDto) { return this.service.finalize(u, id, dto); }
  @Roles(...PAYROLL_ROLES) @Post('appraisals/:id/apply-revision') revise(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ApplyRevisionDto) { return this.service.applyRevision(u, id, dto); }
}
