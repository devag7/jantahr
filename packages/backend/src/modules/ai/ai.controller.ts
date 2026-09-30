import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ADMIN_ROLES, AuthUser, TEAM_VIEW_ROLES } from '../../common/types';
import { AiService, ChatDto } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private service: AiService) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('chat')
  chat(@CurrentUser() u: AuthUser, @Body() dto: ChatDto) { return this.service.chat(u, dto.message); }

  @Roles(...TEAM_VIEW_ROLES)
  @RequiresFeature('analytics')
  @Get('anomalies')
  anomalies(@CurrentUser() u: AuthUser, @Query('days') days?: string) { return this.service.attendanceAnomalies(u, Math.min(90, Math.max(7, Number(days) || 30))); }

  @Roles(...ADMIN_ROLES)
  @RequiresFeature('analytics')
  @Get('attrition-risk')
  attrition(@CurrentUser() u: AuthUser) { return this.service.attritionRisk(u); }
}
