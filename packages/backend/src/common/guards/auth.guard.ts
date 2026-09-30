import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isCloud } from '../edition/edition';
import { EntitlementsService } from '../../modules/billing/entitlements.service';
import { AccountDirectory } from '../../modules/identity/account-directory.service';
import { SupabaseService } from '../../modules/supabase/supabase.service';
import { IS_PUBLIC_KEY, SIGNED_IN_ONLY_KEY } from '../decorators/public.decorator';
import { AuthSession } from '../types';

const deny = (message: string, code?: string) => new UnauthorizedException(code ? { message, code } : message);

/**
 * Every request carries a Supabase Auth access token. The guard verifies it (JWKS or the project's HS256 secret),
 * then resolves the JantaHR account linked to the Supabase user and enforces what Supabase cannot know about:
 * account deactivation, sessions ended by HR, two-factor when the user enrolled it, and Google sign-in by plan.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private supabase: SupabaseService, private accounts: AccountDirectory, private entitlements: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const req = context.switchToHttp().getRequest();
    const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw deny('Authentication required');

    let claims;
    try { claims = await this.supabase.verifyAccessToken(token); } catch { throw deny('Your session has expired. Please sign in again.', 'SESSION_INVALID'); }
    const methods = (Array.isArray(claims.amr) ? claims.amr : []).map((a: unknown) => (typeof a === 'string' ? a : (a as { method?: string } | null)?.method)).filter(Boolean) as string[];
    const session: AuthSession = {
      authId: claims.sub, email: String(claims.email ?? '').toLowerCase(), aal: claims.aal === 'aal2' ? 'aal2' : 'aal1', methods,
      sessionId: typeof claims.session_id === 'string' ? claims.session_id : null, issuedAt: Number(claims.iat ?? 0) * 1000,
      metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
    };
    req.session = session;
    if (this.reflector.getAllAndOverride<boolean>(SIGNED_IN_ONLY_KEY, targets)) return true;

    const a = await this.accounts.byAuthId(claims.sub);
    if (!a || !a.companyId) throw deny('This sign-in is not linked to a JantaHR account. Ask your HR team to add you, or finish creating your company.', 'NO_ACCOUNT');
    if (!a.isActive) throw deny('Your account is disabled. Contact your HR team.', 'ACCOUNT_DISABLED');
    // iat has one-second resolution: a token from the same second as the cut-off is a sign-in that followed it
    if (a.sessionsRevokedAt && session.issuedAt < Math.floor(a.sessionsRevokedAt / 1000) * 1000) throw deny('You were signed out. Please sign in again.', 'SESSION_INVALID');
    if (a.mfaEnabled && session.aal !== 'aal2') throw deny('Enter the code from your authenticator app to continue.', 'MFA_REQUIRED');
    if (methods.includes('oauth') && isCloud() && !(await this.entitlements.has(a.companyId, 'googleSignIn'))) {
      throw deny('Google sign-in is not included in your company plan. Sign in with your email and password.', 'SSO_NOT_IN_PLAN');
    }
    req.user = { userId: a.userId, email: a.email, role: a.role, companyId: a.companyId, employeeId: a.employeeId };
    return true;
  }
}
