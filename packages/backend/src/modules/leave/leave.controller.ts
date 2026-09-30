import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessService } from '../../common/access/access.service';
import { ADMIN_ROLES, APPROVER_ROLES, AuthUser } from '../../common/types';
import { todayIST } from '../../common/utils/dates';
import { LeaveAdminService } from './leave-admin.service';
import { LeaveAllocationService } from './leave-allocation.service';
import { LeaveApplicationService } from './leave-application.service';
import { LeaveBalanceService } from './leave-balance.service';
import { ApplyLeaveDto, AssignPolicyDto, CompOffDto, DecisionDto, EncashmentDto, LeaveListDto, LeavePolicyDto, LeaveTypeDto, ManualAllocationDto, UpdateLeavePolicyDto, UpdateLeaveTypeDto } from './leave.dto';

@Controller('leave')
export class LeaveController {
  constructor(
    private apps: LeaveApplicationService,
    private admin: LeaveAdminService,
    private balances: LeaveBalanceService,
    private allocations: LeaveAllocationService,
    private access: AccessService,
  ) {}

  // types
  @Get('types') types(@CurrentUser() u: AuthUser) { return this.admin.types(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('types') createType(@CurrentUser() u: AuthUser, @Body() dto: LeaveTypeDto) { return this.admin.createType(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('types/:id') updateType(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) { return this.admin.updateType(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Delete('types/:id') deleteType(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.admin.deleteType(u.companyId, id); }

  // policies
  @Roles(...ADMIN_ROLES) @Get('policies') policies(@CurrentUser() u: AuthUser) { return this.admin.policies(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('policies') createPolicy(@CurrentUser() u: AuthUser, @Body() dto: LeavePolicyDto) { return this.admin.createPolicy(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('policies/:id') updatePolicy(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateLeavePolicyDto) { return this.admin.updatePolicy(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Post('policies/:id/assign') assign(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AssignPolicyDto) { return this.admin.assignPolicy(u.companyId, id, dto, u.employeeId); }

  // allocations & balances
  @Roles(...ADMIN_ROLES) @Get('allocations') allocationsList(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string) { return this.admin.allocationsList(u.companyId, employeeId); }
  @Roles(...ADMIN_ROLES) @Post('allocations') manual(@CurrentUser() u: AuthUser, @Body() dto: ManualAllocationDto) { return this.admin.manualAllocation(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Post('accrual/run') runAccrual(@CurrentUser() u: AuthUser) { return this.allocations.accrueEarnedLeaves(todayIST(), u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('rollover/:year') rollover(@CurrentUser() u: AuthUser, @Param('year') year: string) { return this.allocations.rolloverYear(Number(year), u.companyId); }

  @Get('balance')
  async balance(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string) {
    const id = employeeId || this.access.requireEmployee(u);
    await this.access.assertEmployeeAccess(u, id);
    return this.balances.getBalances(id, new Date());
  }

  // applications
  @Post('preview') preview(@CurrentUser() u: AuthUser, @Body() dto: ApplyLeaveDto) { return this.apps.preview(u, dto); }
  @Post('applications') apply(@CurrentUser() u: AuthUser, @Body() dto: ApplyLeaveDto) { return this.apps.apply(u, dto); }
  @Get('applications') list(@CurrentUser() u: AuthUser, @Query() q: LeaveListDto) { return this.apps.list(u, q); }
  @Roles(...APPROVER_ROLES) @Get('applications/pending') pending(@CurrentUser() u: AuthUser) { return this.apps.pendingApprovals(u); }
  @Roles(...APPROVER_ROLES) @Post('applications/:id/approve') approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) { return this.apps.approve(u, id, dto.comment); }
  @Roles(...APPROVER_ROLES) @Post('applications/:id/reject') reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) { return this.apps.reject(u, id, dto.comment); }
  @Post('applications/:id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.apps.cancel(u, id); }

  @Get('calendar')
  calendar(@CurrentUser() u: AuthUser, @Query('year') year?: string, @Query('month') month?: string) {
    const t = todayIST();
    return this.apps.calendarView(u, year ? Number(year) : t.getUTCFullYear(), month ? Number(month) : t.getUTCMonth() + 1);
  }

  // encashment
  @Post('encashments') requestEnc(@CurrentUser() u: AuthUser, @Body() dto: EncashmentDto) { return this.apps.requestEncashment(u, dto); }
  @Get('encashments') encashments(@CurrentUser() u: AuthUser) { return this.apps.listEncashments(u); }
  @Roles(...ADMIN_ROLES) @Post('encashments/:id/approve') approveEnc(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.apps.decideEncashment(u, id, true); }
  @Roles(...ADMIN_ROLES) @Post('encashments/:id/reject') rejectEnc(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.apps.decideEncashment(u, id, false); }

  // comp-off
  @Post('comp-off') requestComp(@CurrentUser() u: AuthUser, @Body() dto: CompOffDto) { return this.apps.requestCompOff(u, dto); }
  @Get('comp-off') compOff(@CurrentUser() u: AuthUser, @Query('scope') scope?: 'approvals') { return this.apps.listCompOff(u, scope === 'approvals'); }
  @Roles(...APPROVER_ROLES) @Post('comp-off/:id/approve') approveComp(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) { return this.apps.decideCompOff(u, id, true, dto.comment); }
  @Roles(...APPROVER_ROLES) @Post('comp-off/:id/reject') rejectComp(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) { return this.apps.decideCompOff(u, id, false, dto.comment); }
}
