import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingCycle, PlanCode, Prisma, Subscription } from '@prisma/client';
import * as crypto from 'crypto';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Cron } from '@nestjs/schedule';
import { isCloud } from '../../common/edition/edition';
import { runExclusive } from '../../common/utils/cron-lock';
import { inProcessJobs } from '../../common/utils/jobs-mode';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from './entitlements.service';
import { gstFromInclusive, gstOnTaxable, invoiceNumber } from './gst';
import { FEATURES, PLANS, PlanKey, TRIAL_DAYS, TRIAL_PLAN, periodPricePaise } from './plans';
import { RazorpayClient, verifyCheckoutSignature, verifyWebhookSignature, RazorpayWebhook } from './razorpay';

import { errorMessage } from '../../common/utils/errors';
export class CheckoutDto {
  @IsIn(['STANDARD', 'PROFESSIONAL']) plan: 'STANDARD' | 'PROFESSIONAL';
  @IsEnum(BillingCycle) cycle: BillingCycle;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) seats: number;
}
export class ConfirmCheckoutDto {
  @IsOptional() @IsString() razorpay_payment_id?: string;
  @IsOptional() @IsString() razorpay_subscription_id?: string;
  @IsOptional() @IsString() razorpay_signature?: string;
}
export class SeatsDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) seats: number;
}

type Provider = 'razorpay' | 'mock';
const DAY = 86_400_000;
const addPeriod = (from: Date, cycle: BillingCycle) => {
  const d = new Date(from);
  if (cycle === 'ANNUAL') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};

/**
 * Cloud-edition subscriptions. Provider = Razorpay in production (RAZORPAY_* set) or `mock` for development and demos
 * (BILLING_PROVIDER=mock). Every state change is idempotent: webhooks may arrive twice, late or before the browser confirm.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly provider: Provider | null;
  private readonly razorpay: RazorpayClient | null;
  private readonly sellerState: string;

  constructor(private prisma: PrismaService, private config: ConfigService, private entitlements: EntitlementsService, private notifications: NotificationsService) {
    const keyId = config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = config.get<string>('RAZORPAY_KEY_SECRET');
    if (keyId && keySecret) {
      let planIds: Record<string, string> = {};
      try { planIds = JSON.parse(config.get<string>('RAZORPAY_PLAN_IDS') || '{}'); } catch { throw new Error('RAZORPAY_PLAN_IDS must be JSON, e.g. {"STANDARD_MONTHLY":"plan_..."}'); }
      this.razorpay = new RazorpayClient({ keyId, keySecret, planIds });
      this.provider = 'razorpay';
    } else {
      this.razorpay = null;
      this.provider = config.get('BILLING_PROVIDER') === 'mock' ? 'mock' : null;
    }
    this.sellerState = config.get<string>('BILLING_SELLER_STATE') || 'Karnataka';
  }

  private requireCloud() {
    if (!isCloud()) throw new BadRequestException('Billing is not used in the self-hosted edition: every feature is already included.');
  }
  private requireProvider(): Provider {
    this.requireCloud();
    if (!this.provider) throw new BadRequestException('Payments are not configured on this server (set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
    return this.provider;
  }

  // ---------------------------------------------------------------------------
  // read

  catalogue() {
    return {
      edition: isCloud() ? 'cloud' : 'self_hosted',
      currency: 'INR',
      gstRate: 0.18,
      trialDays: TRIAL_DAYS,
      features: FEATURES,
      plans: Object.values(PLANS),
    };
  }

  async overview(companyId: string) {
    const [sub, ent, active, invoices] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { companyId } }),
      this.entitlements.for(companyId),
      this.prisma.employee.count({ where: { companyId, status: { not: 'LEFT' } } }),
      this.prisma.billingInvoice.findMany({ where: { companyId }, orderBy: { issuedAt: 'desc' }, take: 24 }),
    ]);
    return {
      ...this.catalogue(),
      provider: this.provider,
      razorpayKeyId: this.provider === 'razorpay' ? this.config.get<string>('RAZORPAY_KEY_ID') : null,
      subscription: sub,
      entitlements: ent,
      usage: { activeEmployees: active, seatLimit: ent.seatLimit },
      invoices,
    };
  }

  // ---------------------------------------------------------------------------
  // lifecycle

  /** Every new cloud company starts on a Professional trial. Called inside the signup transaction. */
  static trialFor(companyId: string): Prisma.SubscriptionUncheckedCreateInput {
    return { companyId, plan: 'FREE', status: 'TRIALING', trialEndsAt: new Date(Date.now() + TRIAL_DAYS * DAY), lapsedPlan: TRIAL_PLAN as PlanCode };
  }

  async checkout(user: AuthUser, dto: CheckoutDto) {
    const provider = this.requireProvider();
    const def = PLANS[dto.plan];
    const active = await this.prisma.employee.count({ where: { companyId: user.companyId, status: { not: 'LEFT' } } });
    const minSeats = Math.max(def.minSeats, active);
    if (dto.seats < minSeats) throw new BadRequestException(`Choose at least ${minSeats} seats (${active} active employees; ${def.name} starts at ${def.minSeats}).`);
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const existing = await this.prisma.subscription.findUnique({ where: { companyId: user.companyId } });
    if (existing?.status === 'ACTIVE' && existing.providerSubscriptionId && existing.plan !== 'FREE') {
      throw new BadRequestException('You already have an active subscription. Change seats or cancel it first.');
    }

    let providerSubscriptionId: string;
    if (provider === 'razorpay') {
      const r = await this.razorpay!.createSubscription({ plan: dto.plan, cycle: dto.cycle, seats: dto.seats, notes: { companyId: user.companyId, plan: dto.plan, cycle: dto.cycle } });
      providerSubscriptionId = r.id;
    } else providerSubscriptionId = `mock_sub_${crypto.randomUUID()}`;

    await this.prisma.subscription.upsert({
      where: { companyId: user.companyId },
      create: { companyId: user.companyId, plan: 'FREE', status: 'ACTIVE', provider, providerSubscriptionId, pendingPlan: dto.plan, pendingCycle: dto.cycle, pendingSeats: dto.seats },
      update: { provider, providerSubscriptionId, pendingPlan: dto.plan, pendingCycle: dto.cycle, pendingSeats: dto.seats },
    });
    const taxable = periodPricePaise(dto.plan, dto.cycle, dto.seats);
    return {
      provider, subscriptionId: providerSubscriptionId,
      razorpayKeyId: provider === 'razorpay' ? this.config.get<string>('RAZORPAY_KEY_ID') : null,
      amount: gstOnTaxable(taxable, this.sellerState, company.state),
      prefill: { name: company.name, email: user.email },
    };
  }

  /** Browser confirmation after checkout. Razorpay: signature verified; mock: accepted directly (dev only). */
  async confirm(user: AuthUser, dto: ConfirmCheckoutDto) {
    const provider = this.requireProvider();
    const sub = await this.prisma.subscription.findUnique({ where: { companyId: user.companyId } });
    if (!sub?.providerSubscriptionId || !sub.pendingPlan) throw new BadRequestException('No checkout in progress');
    let paymentId: string;
    if (provider === 'razorpay') {
      if (dto.razorpay_subscription_id !== sub.providerSubscriptionId) throw new BadRequestException('Subscription does not match the checkout');
      const ok = verifyCheckoutSignature({ paymentId: dto.razorpay_payment_id || '', subscriptionId: sub.providerSubscriptionId, signature: dto.razorpay_signature || '' }, this.config.get<string>('RAZORPAY_KEY_SECRET')!);
      if (!ok) throw new UnauthorizedException('Payment signature could not be verified');
      paymentId = dto.razorpay_payment_id!;
    } else paymentId = `mock_pay_${crypto.randomUUID()}`;
    const taxable = periodPricePaise(sub.pendingPlan as PlanKey, sub.pendingCycle ?? 'MONTHLY', sub.pendingSeats ?? 1);
    const total = Math.round(taxable * 1.18);
    await this.activate(sub, { plan: sub.pendingPlan, cycle: sub.pendingCycle ?? 'MONTHLY', seats: sub.pendingSeats ?? 1, start: new Date(), paymentId, totalPaise: total, provider });
    return this.overview(user.companyId);
  }

  private async activate(sub: Subscription, p: { plan: PlanCode; cycle: BillingCycle; seats: number; start: Date; end?: Date; paymentId: string; totalPaise: number; provider: string }) {
    const end = p.end ?? addPeriod(p.start, p.cycle);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { plan: p.plan, cycle: p.cycle, seats: p.seats, status: 'ACTIVE', trialEndsAt: null, currentPeriodStart: p.start, currentPeriodEnd: end, cancelAtPeriodEnd: false, lapsedPlan: p.plan, pendingPlan: null, pendingCycle: null, pendingSeats: null },
    });
    await this.recordInvoice(sub.companyId, { plan: p.plan, cycle: p.cycle, seats: p.seats, periodStart: p.start, periodEnd: end, totalPaise: p.totalPaise, provider: p.provider, paymentId: p.paymentId });
    this.entitlements.invalidate(sub.companyId);
    await this.notifications.notifyRoles(sub.companyId, ['SUPER_ADMIN'], { title: `${PLANS[p.plan as PlanKey].name} plan is active`, message: `${p.seats} seats, billed ${p.cycle === 'ANNUAL' ? 'yearly' : 'monthly'}. Your invoice is under Billing.`, type: 'BILLING', link: '/hr/billing' });
  }

  private async recordInvoice(companyId: string, p: { plan: PlanCode; cycle: BillingCycle; seats: number; periodStart: Date; periodEnd: Date; totalPaise: number; provider: string; paymentId: string }) {
    if (await this.prisma.billingInvoice.findUnique({ where: { providerPaymentId: p.paymentId } })) return;
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const gst = gstFromInclusive(p.totalPaise, this.sellerState, company.state);
    // sequential numbering: serialised by a transaction-scoped advisory lock
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273645)`;
      const issuedAt = new Date();
      const fyStart = new Date(Date.UTC(issuedAt.getUTCMonth() < 3 ? issuedAt.getUTCFullYear() - 1 : issuedAt.getUTCFullYear(), 3, 1));
      const seq = (await tx.billingInvoice.count({ where: { issuedAt: { gte: fyStart } } })) + 1;
      await tx.billingInvoice.create({
        data: {
          companyId, number: invoiceNumber(issuedAt, seq), plan: p.plan, cycle: p.cycle, seats: p.seats, periodStart: p.periodStart, periodEnd: p.periodEnd,
          taxablePaise: gst.taxablePaise, cgstPaise: gst.cgstPaise, sgstPaise: gst.sgstPaise, igstPaise: gst.igstPaise, totalPaise: gst.totalPaise,
          buyerName: company.legalName || company.name, buyerGstin: company.gstin, buyerState: company.state, provider: p.provider, providerPaymentId: p.paymentId, issuedAt,
        },
      });
    });
  }

  async changeSeats(user: AuthUser, seats: number) {
    const provider = this.requireProvider();
    const sub = await this.prisma.subscription.findUnique({ where: { companyId: user.companyId } });
    if (!sub || sub.status !== 'ACTIVE' || sub.plan === 'FREE') throw new BadRequestException('Seats can be changed on an active paid plan');
    const active = await this.prisma.employee.count({ where: { companyId: user.companyId, status: { not: 'LEFT' } } });
    const min = Math.max(PLANS[sub.plan as PlanKey].minSeats, active);
    if (seats < min) throw new BadRequestException(`You need at least ${min} seats`);
    // adding seats applies now (prorated by the provider); removing seats applies at renewal
    const atCycleEnd = seats < sub.seats;
    if (provider === 'razorpay' && sub.providerSubscriptionId) await this.razorpay!.update(sub.providerSubscriptionId, { seats, atCycleEnd });
    const updated = await this.prisma.subscription.update({ where: { id: sub.id }, data: atCycleEnd ? { pendingSeats: seats } : { seats } });
    this.entitlements.invalidate(user.companyId);
    return { subscription: updated, appliesAt: atCycleEnd ? updated.currentPeriodEnd : new Date() };
  }

  async cancel(user: AuthUser) {
    const provider = this.requireProvider();
    const sub = await this.prisma.subscription.findUnique({ where: { companyId: user.companyId } });
    if (!sub || sub.plan === 'FREE' || !['ACTIVE', 'PAST_DUE'].includes(sub.status)) throw new BadRequestException('There is no paid subscription to cancel');
    if (provider === 'razorpay' && sub.providerSubscriptionId) await this.razorpay!.cancel(sub.providerSubscriptionId, true);
    const updated = await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED', cancelAtPeriodEnd: true, lapsedPlan: sub.plan } });
    this.entitlements.invalidate(user.companyId);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // webhooks (API endpoint and the `billing-webhook` Supabase Edge Function both land here)

  async receiveRazorpayWebhook(rawBody: Buffer | undefined, signature: string | undefined, eventId: string | undefined) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) throw new BadRequestException('Webhook secret not configured');
    if (!rawBody || !verifyWebhookSignature(rawBody, signature, secret)) throw new UnauthorizedException('Invalid webhook signature');
    const payload = JSON.parse(rawBody.toString('utf8'));
    const id = eventId || crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 64);
    await this.prisma.billingEvent.upsert({ where: { id }, create: { id, provider: 'razorpay', type: String(payload.event || 'unknown').slice(0, 80), payload, receivedVia: 'api' }, update: {} });
    await this.processInbox();
    return { ok: true };
  }

  /** Applies unprocessed webhook events in arrival order. Safe to run concurrently (advisory lock) and repeatedly. */
  async processInbox(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;
    await this.prisma.$transaction(async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(918273646) AS locked`;
      if (!locked) return;
      const events = await tx.billingEvent.findMany({ where: { processedAt: null }, orderBy: { createdAt: 'asc' }, take: 100 });
      for (const ev of events) {
        try {
          await this.applyRazorpayEvent(ev.payload as unknown as RazorpayWebhook);
          await tx.billingEvent.update({ where: { id: ev.id }, data: { processedAt: new Date(), error: null } });
          processed++;
        } catch (e) {
          failed++;
          await tx.billingEvent.update({ where: { id: ev.id }, data: { error: errorMessage(e).slice(0, 2000) } });
        }
      }
    }, { timeout: 60_000 });
    return { processed, failed };
  }

  private async applyRazorpayEvent(body: RazorpayWebhook) {
    const entity = body?.payload?.subscription?.entity;
    if (!entity?.id) return; // not a subscription event
    const sub = await this.prisma.subscription.findUnique({ where: { providerSubscriptionId: entity.id } });
    if (!sub) throw new NotFoundException(`No subscription ${entity.id}`);
    const ts = (s?: number | null) => (s ? new Date(s * 1000) : undefined);
    const plan = (sub.pendingPlan ?? sub.plan) as PlanCode;
    const cycle = (sub.pendingCycle ?? sub.cycle) as BillingCycle;
    const seats = Number(entity.quantity) || sub.pendingSeats || sub.seats;
    switch (body.event) {
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.resumed': {
        const payment = body.payload?.payment?.entity;
        if (payment?.id) {
          await this.activate(sub, { plan, cycle, seats, start: ts(entity.current_start) ?? new Date(), end: ts(entity.current_end), paymentId: payment.id, totalPaise: Number(payment.amount), provider: 'razorpay' });
        } else {
          await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE', currentPeriodStart: ts(entity.current_start), currentPeriodEnd: ts(entity.current_end) } });
        }
        break;
      }
      case 'subscription.pending':
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PAST_DUE' } });
        await this.notifications.notifyRoles(sub.companyId, ['SUPER_ADMIN'], { title: 'Payment failed', message: 'Your subscription renewal did not go through. Update the payment method to keep paid modules.', type: 'BILLING', link: '/hr/billing', email: true });
        break;
      case 'subscription.halted':
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'HALTED', lapsedPlan: sub.plan } });
        break;
      case 'subscription.cancelled':
      case 'subscription.completed':
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED', lapsedPlan: sub.plan, currentPeriodEnd: ts(entity.current_end) ?? sub.currentPeriodEnd } });
        break;
      case 'subscription.updated':
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { seats, pendingSeats: null } });
        break;
      default:
        break;
    }
    this.entitlements.invalidate(sub.companyId);
  }

  // ---------------------------------------------------------------------------
  // scheduled

  @Cron('0 3 * * *', { timeZone: 'Asia/Kolkata' })
  async sweepTick() {
    if (inProcessJobs()) await runExclusive(this.prisma, 'billing-sweep', () => this.sweep()).catch((e) => this.logger.error(`billing sweep failed: ${e.message}`));
  }

  @Cron('*/10 * * * *')
  async inboxTick() {
    if (inProcessJobs() && isCloud()) await this.processInbox().catch((e) => this.logger.error(`billing inbox failed: ${e.message}`));
  }

  /** Daily: end expired trials and finished cancellations, warn admins 3 days before a trial ends. */
  async sweep(now = new Date()) {
    if (!isCloud()) return { expiredTrials: 0, endedCancellations: 0, reminders: 0 };
    const expired = await this.prisma.subscription.updateMany({ where: { status: 'TRIALING', trialEndsAt: { lt: now } }, data: { status: 'EXPIRED' } });
    const ended = await this.prisma.subscription.updateMany({ where: { status: 'CANCELLED', currentPeriodEnd: { lt: now } }, data: { status: 'EXPIRED' } });
    const soon = await this.prisma.subscription.findMany({ where: { status: 'TRIALING', trialEndsAt: { gte: new Date(now.getTime() + 2 * DAY), lt: new Date(now.getTime() + 3 * DAY) } } });
    for (const s of soon) await this.notifications.notifyRoles(s.companyId, ['SUPER_ADMIN'], { title: 'Your trial ends in 3 days', message: 'Choose a plan to keep payroll and the other paid modules. Your data stays safe either way.', type: 'BILLING', link: '/hr/billing', email: true });
    return { expiredTrials: expired.count, endedCancellations: ended.count, reminders: soon.length };
  }

  // ---------------------------------------------------------------------------
  // operator view

  async tenants(user: AuthUser) {
    const allowed = (this.config.get<string>('PLATFORM_ADMIN_EMAILS') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(user.email.toLowerCase())) throw new ForbiddenException();
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true, state: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 });
    const subs = await this.prisma.subscription.findMany({ where: { companyId: { in: companies.map((c) => c.id) } } });
    const counts = await this.prisma.employee.groupBy({ by: ['companyId'], where: { status: { not: 'LEFT' } }, _count: true });
    const bySub = new Map(subs.map((s) => [s.companyId, s]));
    const byCount = new Map(counts.map((c) => [c.companyId, c._count]));
    const rows = companies.map((c) => {
      const s = bySub.get(c.id);
      const mrr = s && s.status === 'ACTIVE' && PLANS[s.plan as PlanKey].pricePaise ? Math.round(periodPricePaise(s.plan as PlanKey, s.cycle, s.seats) / (s.cycle === 'ANNUAL' ? 12 : 1)) : 0;
      return { ...c, employees: byCount.get(c.id) ?? 0, plan: s?.plan ?? 'FREE', status: s?.status ?? 'ACTIVE', seats: s?.seats ?? 0, trialEndsAt: s?.trialEndsAt ?? null, mrrPaise: mrr };
    });
    return { tenants: rows, totals: { tenants: rows.length, paying: rows.filter((r) => r.mrrPaise > 0).length, mrrPaise: rows.reduce((a, r) => a + r.mrrPaise, 0) } };
  }

  async invoice(companyId: string, id: string) {
    const inv = await this.prisma.billingInvoice.findFirst({ where: { id, companyId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }
}
