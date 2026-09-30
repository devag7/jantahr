import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isCloud } from '../../common/edition/edition';
import { PrismaService } from '../../prisma/prisma.service';
import { Entitlements, resolveEntitlements, selfHostedEntitlements, SubscriptionLike } from './entitlements';
import { FEATURES, FeatureKey, PLANS } from './plans';

/** 402 with a machine-readable code so the web app can show an upgrade prompt instead of a generic error. */
export class PlanRequiredException extends HttpException {
  constructor(feature: FeatureKey | 'seats', message: string) {
    super({ statusCode: HttpStatus.PAYMENT_REQUIRED, code: feature === 'seats' ? 'SEAT_LIMIT' : 'PLAN_REQUIRED', feature, message }, HttpStatus.PAYMENT_REQUIRED);
  }
}

const TTL_MS = 15_000;

@Injectable()
export class EntitlementsService {
  private cache = new Map<string, { at: number; e: Entitlements }>();
  constructor(private prisma: PrismaService) {}

  async for(companyId: string): Promise<Entitlements> {
    if (!isCloud()) return selfHostedEntitlements();
    const hit = this.cache.get(companyId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.e;
    const sub = await this.prisma.subscription.findUnique({ where: { companyId } });
    const e = resolveEntitlements(sub as SubscriptionLike | null);
    this.cache.set(companyId, { at: Date.now(), e });
    return e;
  }

  invalidate(companyId: string) {
    this.cache.delete(companyId);
  }

  async has(companyId: string, feature: FeatureKey): Promise<boolean> {
    return (await this.for(companyId)).features.includes(feature);
  }

  /** `write=false` also accepts features that are read-only after a lapse. */
  async assertFeature(companyId: string, feature: FeatureKey, write = true): Promise<void> {
    const e = await this.for(companyId);
    if (e.features.includes(feature)) return;
    if (!write && e.readOnlyFeatures.includes(feature)) return;
    const needed = (['STANDARD', 'PROFESSIONAL'] as const).find((p) => PLANS[p].features.includes(feature)) ?? 'PROFESSIONAL';
    throw new PlanRequiredException(
      feature,
      e.readOnlyFeatures.includes(feature)
        ? `${FEATURES[feature]} is read-only because your subscription is not active. Renew to make changes.`
        : `${FEATURES[feature]} is part of the ${PLANS[needed].name} plan. Upgrade to use it.`,
    );
  }

  /** Blocks adding employees beyond the plan's limit (Free: 20; paid: seats bought). */
  async assertSeats(companyId: string, adding = 1): Promise<void> {
    const e = await this.for(companyId);
    if (e.seatLimit === null) return;
    const active = await this.prisma.employee.count({ where: { companyId, status: { not: 'LEFT' } } });
    if (active + adding > e.seatLimit) {
      throw new PlanRequiredException('seats', e.plan === 'FREE'
        ? `The Free plan covers up to ${e.seatLimit} employees. Upgrade to add more.`
        : `Your plan has ${e.seatLimit} seats and ${active} are in use. Add seats under Billing to add more employees.`);
    }
  }
}
