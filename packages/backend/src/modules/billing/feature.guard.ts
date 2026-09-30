import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { EntitlementsService } from './entitlements.service';
import { FeatureKey } from './plans';

export const FEATURE_KEY = 'requiredFeature';
/** Gate a controller or handler behind a plan feature (cloud edition). Read requests stay allowed after a lapse. */
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(FEATURE_KEY, feature);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private reflector: Reflector, private entitlements: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const feature = this.reflector.getAllAndOverride<FeatureKey>(FEATURE_KEY, targets);
    if (!feature || this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const req = context.switchToHttp().getRequest();
    if (!req.user?.companyId) return true; // unauthenticated requests are rejected by JwtAuthGuard earlier
    await this.entitlements.assertFeature(req.user.companyId, feature, req.method !== 'GET');
    return true;
  }
}
