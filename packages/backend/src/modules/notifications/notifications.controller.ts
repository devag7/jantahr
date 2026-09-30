import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    const [items, unreadCount] = await Promise.all([this.service.list(user.userId, unread === 'true'), this.service.unreadCount(user.userId)]);
    return { items, unreadCount };
  }

  @Get('unread-count')
  async count(@CurrentUser() user: AuthUser) {
    return { count: await this.service.unreadCount(user.userId) };
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.service.markAllRead(user.userId);
    return { ok: true };
  }

  @Patch(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.service.markRead(user.userId, id);
    return { ok: true };
  }
}
