import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import { CommentDto, HelpdeskService, TICKET_CATEGORIES, TicketDto, TicketUpdateDto } from './helpdesk.service';

@RequiresFeature('helpdesk')
@Controller('helpdesk')
export class HelpdeskController {
  constructor(private service: HelpdeskService) {}

  @Get('categories') categories() { return TICKET_CATEGORIES; }
  @Post('tickets') create(@CurrentUser() u: AuthUser, @Body() dto: TicketDto) { return this.service.create(u, dto); }
  @Get('tickets') list(@CurrentUser() u: AuthUser, @Query('scope') scope: 'mine' | 'all' = 'mine', @Query('status') status?: string) { return this.service.list(u, scope, status); }
  @Get('tickets/:id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.one(u, id); }
  @Post('tickets/:id/comments') comment(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CommentDto) { return this.service.comment(u, id, dto); }
  @Patch('tickets/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TicketUpdateDto) { return this.service.update(u, id, dto); }
}
