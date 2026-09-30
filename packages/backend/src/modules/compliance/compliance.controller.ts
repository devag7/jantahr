import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, PAYROLL_ROLES, READ_ALL_ROLES } from '../../common/types';
import { ComplianceService, MarkFiledDto } from './compliance.service';

@RequiresFeature('statutory')
@Controller('compliance')
export class ComplianceController {
  constructor(private service: ComplianceService) {}

  @Roles(...READ_ALL_ROLES) @Get('calendar') calendar(@CurrentUser() u: AuthUser) { return this.service.calendar(u.companyId); }
  @Roles(...READ_ALL_ROLES) @Get('overtime') overtime(@CurrentUser() u: AuthUser) { return this.service.overtime(u.companyId); }
  @Roles(...PAYROLL_ROLES) @Put('filings/:key') mark(@CurrentUser() u: AuthUser, @Param('key') key: string, @Body() dto: MarkFiledDto) { return this.service.markFiled(u, key, dto); }
  @Roles(...PAYROLL_ROLES) @Delete('filings/:key') unmark(@CurrentUser() u: AuthUser, @Param('key') key: string) { return this.service.unmark(u, key); }
}
