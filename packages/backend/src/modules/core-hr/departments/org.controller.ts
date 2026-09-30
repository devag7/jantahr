import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES, AuthUser } from '../../../common/types';
import { DepartmentDto, DesignationDto, OrgService, UpdateDepartmentDto, UpdateDesignationDto } from './org.service';

@Controller()
export class OrgController {
  constructor(private org: OrgService) {}

  @Get('departments') departments(@CurrentUser() u: AuthUser) { return this.org.departments(u.companyId); }
  @Get('departments/tree') tree(@CurrentUser() u: AuthUser) { return this.org.departmentTree(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('departments') createDept(@CurrentUser() u: AuthUser, @Body() dto: DepartmentDto) { return this.org.createDepartment(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('departments/:id') updateDept(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) { return this.org.updateDepartment(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Delete('departments/:id') deleteDept(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.org.deleteDepartment(u.companyId, id); }

  @Get('designations') designations(@CurrentUser() u: AuthUser) { return this.org.designations(u.companyId); }
  @Roles(...ADMIN_ROLES) @Post('designations') createDesig(@CurrentUser() u: AuthUser, @Body() dto: DesignationDto) { return this.org.createDesignation(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('designations/:id') updateDesig(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateDesignationDto) { return this.org.updateDesignation(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Delete('designations/:id') deleteDesig(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.org.deleteDesignation(u.companyId, id); }
}
