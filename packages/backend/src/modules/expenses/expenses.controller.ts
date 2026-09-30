import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import * as multer from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MAX_UPLOAD_BYTES, StorageService } from '../../common/storage/storage.service';
import { APPROVER_ROLES, AuthUser } from '../../common/types';
import { EXPENSE_CATEGORIES, ExpenseClaimDto, ExpenseDecisionDto, ExpensesService, TravelRequestDto, UpdateExpenseClaimDto } from './expenses.service';

@RequiresFeature('expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private service: ExpensesService, private storage: StorageService) {}

  @Get('categories') categories() { return EXPENSE_CATEGORIES; }
  @Post('claims') create(@CurrentUser() u: AuthUser, @Body() dto: ExpenseClaimDto) { return this.service.create(u, dto); }
  @Get('claims') list(@CurrentUser() u: AuthUser, @Query('scope') scope: 'mine' | 'team' | 'all' = 'mine', @Query('status') status?: string) { return this.service.list(u, scope, status); }
  @Patch('claims/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateExpenseClaimDto) { return this.service.update(u, id, dto); }
  @Post('claims/:id/submit') submit(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.submit(u, id); }
  @Delete('claims/:id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u, id); }
  @Roles(...APPROVER_ROLES) @Post('claims/:id/approve') approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ExpenseDecisionDto) { return this.service.decide(u, id, true, dto); }
  @Roles(...APPROVER_ROLES) @Post('claims/:id/reject') reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ExpenseDecisionDto) { return this.service.decide(u, id, false, dto); }

  @Post('receipts')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file?: Express.Multer.File, @Body('upload') ticket?: string) { return this.service.uploadReceipt(u, file, ticket); }

  @Get('receipts/download')
  async receipt(@CurrentUser() u: AuthUser, @Query('key') key: string, @Req() req: Request, @Res() res: Response) {
    await this.storage.send(req, res, await this.service.downloadReceipt(u, key), 'receipt', 'inline');
  }

  @Post('travel') createTravel(@CurrentUser() u: AuthUser, @Body() dto: TravelRequestDto) { return this.service.createTravel(u, dto); }
  @Get('travel') travel(@CurrentUser() u: AuthUser, @Query('scope') scope: 'mine' | 'team' = 'mine') { return this.service.listTravel(u, scope); }
  @Roles(...APPROVER_ROLES) @Post('travel/:id/approve') approveTravel(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('comment') comment?: string) { return this.service.decideTravel(u, id, true, comment); }
  @Roles(...APPROVER_ROLES) @Post('travel/:id/reject') rejectTravel(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('comment') comment?: string) { return this.service.decideTravel(u, id, false, comment); }
}
