import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, READ_ALL_ROLES } from '../../common/types';
import { BillingService, CheckoutDto, ConfirmCheckoutDto, SeatsDto } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { invoicePdf } from './invoice-pdf';

@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService, private entitlements: EntitlementsService, private config: ConfigService) {}

  /** Public: plans, prices and features for the pricing page. */
  @Public() @Get('plans') plans() { return this.billing.catalogue(); }

  /** Every signed-in user: what this company can use (drives navigation and upgrade prompts). */
  @Get('entitlements') ent(@CurrentUser() u: AuthUser) { return this.entitlements.for(u.companyId); }

  @Roles(...READ_ALL_ROLES) @Get() overview(@CurrentUser() u: AuthUser) { return this.billing.overview(u.companyId); }
  @Roles(Role.SUPER_ADMIN) @Post('checkout') checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) { return this.billing.checkout(u, dto); }
  @Roles(Role.SUPER_ADMIN) @Post('checkout/confirm') confirm(@CurrentUser() u: AuthUser, @Body() dto: ConfirmCheckoutDto) { return this.billing.confirm(u, dto); }
  @Roles(Role.SUPER_ADMIN) @Post('seats') seats(@CurrentUser() u: AuthUser, @Body() dto: SeatsDto) { return this.billing.changeSeats(u, dto.seats); }
  @Roles(Role.SUPER_ADMIN) @Post('cancel') cancel(@CurrentUser() u: AuthUser) { return this.billing.cancel(u); }

  @Roles(...READ_ALL_ROLES)
  @Get('invoices/:id/pdf')
  async invoicePdf(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const inv = await this.billing.invoice(u.companyId, id);
    const pdf = await invoicePdf(inv, {
      name: this.config.get('BILLING_SELLER_NAME') || 'JantaHR', address: this.config.get('BILLING_SELLER_ADDRESS') || '',
      state: this.config.get('BILLING_SELLER_STATE') || 'Karnataka', gstin: this.config.get('BILLING_SELLER_GSTIN') || '', sac: this.config.get('BILLING_SAC_CODE') || '997331',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.number.replace(/\//g, '-')}.pdf"`);
    res.send(pdf);
  }

  /** Razorpay → API. The Supabase Edge Function `billing-webhook` is the alternative entry point (same inbox). */
  @Public() @HttpCode(200)
  @Post('webhooks/razorpay')
  webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-razorpay-signature') sig?: string, @Headers('x-razorpay-event-id') eventId?: string) {
    return this.billing.receiveRazorpayWebhook(req.rawBody, sig, eventId);
  }

  /** Operator dashboard (PLATFORM_ADMIN_EMAILS). */
  @Get('platform/tenants') tenants(@CurrentUser() u: AuthUser) { return this.billing.tenants(u); }
}
