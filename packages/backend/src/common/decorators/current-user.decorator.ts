import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthSession, AuthUser } from '../types';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** The Supabase session behind the request (how the user signed in, AAL, session id). */
export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthSession => {
  return ctx.switchToHttp().getRequest().session;
});
