import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types';
import { SupabaseService } from './supabase.service';

@Controller()
export class SupabaseController {
  constructor(private supabase: SupabaseService) {}

  /** Public runtime config so one web build works for both editions. */
  @Public() @Get('meta/runtime') runtime() {
    return this.supabase.runtime(true);
  }

  /** Channel for live notification pings (Supabase Realtime Broadcast). */
  @Get('notifications/realtime') realtime(@CurrentUser() u: AuthUser) {
    return this.supabase.realtimeEnabled
      ? { enabled: true, url: this.supabase.publicUrl, publishableKey: this.supabase.anonKey, topic: this.supabase.notificationTopic(u.userId), event: 'notification' }
      : { enabled: false };
  }
}
