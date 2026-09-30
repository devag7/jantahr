import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessService } from '../../common/access/access.service';
import { ADMIN_ROLES, APPROVER_ROLES, AuthUser, TEAM_VIEW_ROLES } from '../../common/types';
import { toDateOnly, todayIST } from '../../common/utils/dates';
import {
  BiometricPushDto, DailyQueryDto, DecisionDto, DeviceDto, ImportAttendanceDto, ManualMarkDto, PunchDto, RangeDto, RegularizationDto, RosterDto, ShiftAssignmentDto,
  ShiftLocationDto, ShiftTypeDto, UpdateShiftLocationDto, UpdateShiftTypeDto,
} from './attendance.dto';
import { AttendanceService } from './attendance.service';
import { CheckinService } from './checkin.service';
import { ShiftService } from './shift.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private attendance: AttendanceService, private checkin: CheckinService, private shifts: ShiftService, private access: AccessService) {}

  // ---- self service ----
  @Post('punch') punch(@CurrentUser() u: AuthUser, @Body() dto: PunchDto, @Req() req: Request) { return this.checkin.punch(u, dto, req.ip); }
  @Get('status') status(@CurrentUser() u: AuthUser) { return this.checkin.status(u); }

  @Get('me')
  me(@CurrentUser() u: AuthUser, @Query('year') year?: string, @Query('month') month?: string, @Query('employeeId') employeeId?: string) {
    const t = todayIST();
    return this.attendance.monthLog(u, employeeId || this.access.requireEmployee(u), year ? Number(year) : t.getUTCFullYear(), month ? Number(month) : t.getUTCMonth() + 1);
  }

  // ---- team / company views ----
  @Roles(...TEAM_VIEW_ROLES) @Get('daily') daily(@CurrentUser() u: AuthUser, @Query() q: DailyQueryDto) { return this.attendance.daily(u, q); }

  @Roles(...TEAM_VIEW_ROLES)
  @Get('summary')
  summary(@CurrentUser() u: AuthUser, @Query('year') year?: string, @Query('month') month?: string, @Query('departmentId') departmentId?: string) {
    const t = todayIST();
    return this.attendance.monthlySummary(u, year ? Number(year) : t.getUTCFullYear(), month ? Number(month) : t.getUTCMonth() + 1, departmentId);
  }

  // ---- HR tools ----
  @Roles(...ADMIN_ROLES) @Post('mark') mark(@CurrentUser() u: AuthUser, @Body() dto: ManualMarkDto) { return this.attendance.manualMark(u, dto); }
  @Roles(...ADMIN_ROLES) @Post('import') import(@CurrentUser() u: AuthUser, @Body() dto: ImportAttendanceDto) { return this.attendance.importCsv(u, dto.csv); }
  @Roles(...ADMIN_ROLES) @Post('process') process(@CurrentUser() u: AuthUser, @Body() dto: RangeDto) { return this.attendance.processRange(u.companyId, toDateOnly(dto.from), toDateOnly(dto.to)); }
  @Roles(...ADMIN_ROLES) @Post('mark-absent') markAbsent(@CurrentUser() u: AuthUser, @Body() dto: RangeDto) { return this.attendance.markAbsent(u.companyId, toDateOnly(dto.from), toDateOnly(dto.to)); }

  // ---- regularization ----
  @Post('requests') request(@CurrentUser() u: AuthUser, @Body() dto: RegularizationDto) { return this.attendance.requestRegularization(u, dto); }
  @Get('requests') requests(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('scope') scope?: 'approvals') { return this.attendance.listRequests(u, status, scope === 'approvals'); }
  @Roles(...APPROVER_ROLES) @Post('requests/:id/approve') approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) { return this.attendance.decideRequest(u, id, true, dto.comment); }
  @Roles(...APPROVER_ROLES) @Post('requests/:id/reject') reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) { return this.attendance.decideRequest(u, id, false, dto.comment); }

  // ---- shifts ----
  @Get('shifts') shiftTypes(@CurrentUser() u: AuthUser) { return this.shifts.types(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('shifts') createShift(@CurrentUser() u: AuthUser, @Body() dto: ShiftTypeDto) { return this.shifts.createType(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('shifts/:id') updateShift(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateShiftTypeDto) { return this.shifts.updateType(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Delete('shifts/:id') deleteShift(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.shifts.deleteType(u.companyId, id); }
  @Roles(...TEAM_VIEW_ROLES) @Get('shift-assignments') assignments(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string) { return this.shifts.assignments(u.companyId, employeeId); }
  @Roles(...ADMIN_ROLES) @Post('shift-assignments') assign(@CurrentUser() u: AuthUser, @Body() dto: ShiftAssignmentDto) { return this.shifts.assign(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Post('roster') roster(@CurrentUser() u: AuthUser, @Body() dto: RosterDto) { return this.shifts.roster(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Delete('shift-assignments/:id') removeAssignment(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.shifts.removeAssignment(u.companyId, id); }

  // ---- geo-fence ----
  @Get('locations') locations(@CurrentUser() u: AuthUser) { return this.shifts.locations(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('locations') createLocation(@CurrentUser() u: AuthUser, @Body() dto: ShiftLocationDto) { return this.shifts.createLocation(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('locations/:id') updateLocation(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateShiftLocationDto) { return this.shifts.updateLocation(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Delete('locations/:id') deleteLocation(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.shifts.deleteLocation(u.companyId, id); }

  // ---- biometric ----
  @RequiresFeature('biometric') @Roles(...ADMIN_ROLES) @Get('devices') devices(@CurrentUser() u: AuthUser) { return this.shifts.devices(u.companyId); }
  @RequiresFeature('biometric') @Roles(...ADMIN_ROLES) @Post('devices') createDevice(@CurrentUser() u: AuthUser, @Body() dto: DeviceDto) { return this.shifts.createDevice(u.companyId, dto); }
  @RequiresFeature('biometric') @Roles(...ADMIN_ROLES) @Post('devices/:id/active') deviceActive(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('isActive') isActive: boolean) { return this.shifts.setDeviceActive(u.companyId, id, !!isActive); }

  @Public()
  @HttpCode(200)
  @Post('biometric/push')
  push(@Headers('x-device-serial') serial: string, @Headers('x-device-key') key: string, @Body() dto: BiometricPushDto) {
    return this.checkin.biometricPush(serial, key, dto);
  }
}
