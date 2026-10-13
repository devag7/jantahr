import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES, AuthUser } from '../../../common/types';
import { INDIAN_STATES } from '../master-data';
import { CompanyService, UpdateCompanyDto } from './company.service';

@Controller()
export class CompanyController {
  constructor(private service: CompanyService) {}

  @Get('company')
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.companyId);
  }

  @Roles(...ADMIN_ROLES)
  @Get('company/setup-status')
  setupStatus(@CurrentUser() user: AuthUser) {
    return this.service.setupStatus(user.companyId);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('company')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyDto) {
    return this.service.update(user.companyId, dto);
  }

  // static reference list; the sign-up form needs it before anyone is signed in
  @Public()
  @Get('masters/states')
  states() {
    return INDIAN_STATES;
  }
}
