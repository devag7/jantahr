import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES, AuthUser } from '../../../common/types';
import { AnnouncementDto, EngagementService, PolicyDto, UpdateAnnouncementDto, UpdatePolicyDto } from './engagement.service';

@Controller()
export class EngagementController {
  constructor(private service: EngagementService) {}

  @Get('announcements') list(@CurrentUser() u: AuthUser) { return this.service.announcements(u.companyId, ADMIN_ROLES.includes(u.role)); }
  @Roles(...ADMIN_ROLES) @Post('announcements') create(@CurrentUser() u: AuthUser, @Body() dto: AnnouncementDto) { return this.service.createAnnouncement(u, dto); }
  @Roles(...ADMIN_ROLES) @Patch('announcements/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateAnnouncementDto) { return this.service.updateAnnouncement(u.companyId, id, dto); }
  @Roles(...ADMIN_ROLES) @Delete('announcements/:id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.deleteAnnouncement(u.companyId, id); }

  @Get('policies') policies(@CurrentUser() u: AuthUser) { return this.service.policies(u, ADMIN_ROLES.includes(u.role)); }
  @Roles(...ADMIN_ROLES) @Post('policies') createPolicy(@CurrentUser() u: AuthUser, @Body() dto: PolicyDto) { return this.service.createPolicy(u.companyId, dto); }
  @Roles(...ADMIN_ROLES) @Patch('policies/:id') updatePolicy(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdatePolicyDto) { return this.service.updatePolicy(u.companyId, id, dto); }
  @Post('policies/:id/acknowledge') ack(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.acknowledge(u, id); }
  @Roles(...ADMIN_ROLES) @Get('policies/:id/acknowledgements') acks(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.acknowledgementStatus(u.companyId, id); }
}
