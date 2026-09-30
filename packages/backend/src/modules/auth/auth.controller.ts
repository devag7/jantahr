import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentSession, CurrentUser } from '../../common/decorators/current-user.decorator';
import { SignedInOnly } from '../../common/decorators/public.decorator';
import { AuthSession, AuthUser } from '../../common/types';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ProvisionCompanyDto, SetPasswordDto } from './dto/auth.dto';

/** Sign-in, sign-out, password reset links and TOTP happen in Supabase Auth; these are the JantaHR-side steps. */
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @SignedInOnly()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('provision')
  provision(@CurrentSession() session: AuthSession, @Body() dto: ProvisionCompanyDto) {
    return this.auth.provisionCompany(session, dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @Post('change-password')
  change(@CurrentUser() user: AuthUser, @CurrentSession() session: AuthSession, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, session, dto.currentPassword, dto.newPassword);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @Post('set-password')
  setPassword(@CurrentUser() user: AuthUser, @CurrentSession() session: AuthSession, @Body() dto: SetPasswordDto) {
    return this.auth.setPassword(user, session, dto.newPassword);
  }

  @HttpCode(200)
  @Post('mfa/sync')
  syncMfa(@CurrentUser() user: AuthUser, @CurrentSession() session: AuthSession) {
    return this.auth.syncMfa(user, session);
  }
}
