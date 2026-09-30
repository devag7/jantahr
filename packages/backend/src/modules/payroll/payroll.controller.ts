import { RequiresFeature } from '../billing/feature.guard';
import { salaryTdsLaw } from './engine/tax-forms';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, PAYROLL_ROLES, READ_ALL_ROLES } from '../../common/types';
import { fiscalYearStartYear, todayIST } from '../../common/utils/dates';
import {
  AdditionalSalaryDto, AssignmentDto, BulkAssignmentDto, DeclarationDto, LoanDto, PeriodQueryDto, RunDto, SalaryComponentDto, SalaryStructureDto,
  StructurePreviewDto, UpdateSalaryComponentDto, UpdateSalaryStructureDto,
} from './payroll.dto';
import { PayrollService } from './runs/payroll.service';
import { PayrollRunService } from './runs/payroll-run.service';
import { SalarySetupService } from './setup/salary-setup.service';
import { StatutoryReportsService } from './reports/statutory-reports.service';
import { TaxDeclarationService } from './tax/tax-declaration.service';

function send(res: Response, filename: string, body: string | Buffer, type: string) {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

@RequiresFeature('payroll')
@Controller('payroll')
export class PayrollController {
  constructor(
    private payroll: PayrollService,
    private payrollRuns: PayrollRunService,
    private setup: SalarySetupService,
    private reports: StatutoryReportsService,
    private tax: TaxDeclarationService,
  ) {}

  // ---- setup ----
  @Roles(...READ_ALL_ROLES) @Get('components') components(@CurrentUser() u: AuthUser) { return this.setup.components(u.companyId); }
  @Roles(...PAYROLL_ROLES) @Post('components') createComponent(@CurrentUser() u: AuthUser, @Body() dto: SalaryComponentDto) { return this.setup.createComponent(u.companyId, dto); }
  @Roles(...PAYROLL_ROLES) @Patch('components/:id') updateComponent(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateSalaryComponentDto) { return this.setup.updateComponent(u.companyId, id, dto); }
  @Roles(...PAYROLL_ROLES) @Delete('components/:id') deleteComponent(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.setup.deleteComponent(u.companyId, id); }

  @Roles(...READ_ALL_ROLES) @Get('structures') structures(@CurrentUser() u: AuthUser) { return this.setup.structures(u.companyId); }
  @Roles(...PAYROLL_ROLES) @Post('structures/preview') previewStructure(@CurrentUser() u: AuthUser, @Body() dto: StructurePreviewDto) { return this.setup.preview(u.companyId, dto); }
  @Roles(...PAYROLL_ROLES) @Post('structures') createStructure(@CurrentUser() u: AuthUser, @Body() dto: SalaryStructureDto) { return this.setup.createStructure(u.companyId, dto); }
  @Roles(...PAYROLL_ROLES) @Patch('structures/:id') updateStructure(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateSalaryStructureDto) { return this.setup.updateStructure(u.companyId, id, dto); }
  @Roles(...PAYROLL_ROLES) @Delete('structures/:id') deleteStructure(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.setup.deleteStructure(u.companyId, id); }

  @Roles(...READ_ALL_ROLES) @Get('assignments') assignments(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string) { return this.setup.assignments(u.companyId, employeeId); }
  @Roles(...PAYROLL_ROLES) @Post('assignments') assign(@CurrentUser() u: AuthUser, @Body() dto: AssignmentDto) { return this.setup.assign(u, dto); }
  @Roles(...PAYROLL_ROLES) @Post('assignments/bulk') bulkAssign(@CurrentUser() u: AuthUser, @Body() dto: BulkAssignmentDto) { return this.setup.bulkAssign(u, dto); }

  @Roles(...READ_ALL_ROLES) @Get('additional') additional(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string) { return this.setup.additional(u.companyId, employeeId); }
  @Roles(...PAYROLL_ROLES) @Post('additional') createAdditional(@CurrentUser() u: AuthUser, @Body() dto: AdditionalSalaryDto) { return this.setup.createAdditional(u.companyId, dto); }
  @Roles(...PAYROLL_ROLES) @Delete('additional/:id') deleteAdditional(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.setup.deleteAdditional(u.companyId, id); }

  @Roles(...READ_ALL_ROLES) @Get('loans') loans(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId?: string) { return this.setup.loans(u.companyId, employeeId); }
  @Roles(...PAYROLL_ROLES) @Post('loans') createLoan(@CurrentUser() u: AuthUser, @Body() dto: LoanDto) { return this.setup.createLoan(u.companyId, dto); }
  @Roles(...PAYROLL_ROLES) @Post('loans/:id/close') closeLoan(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.setup.closeLoan(u.companyId, id); }

  // ---- runs ----
  @Roles(...READ_ALL_ROLES) @Get('runs') runs(@CurrentUser() u: AuthUser) { return this.payrollRuns.listRuns(u.companyId); }
  @Roles(...PAYROLL_ROLES) @Post('runs') createRun(@CurrentUser() u: AuthUser, @Body() dto: RunDto) { return this.payrollRuns.createRun(u, dto.month, dto.year, dto); }
  @Roles(...READ_ALL_ROLES) @Get('runs/:id') run(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.payrollRuns.getRunDetail(u.companyId, id); }
  @Roles(...PAYROLL_ROLES) @Post('runs/:id/generate') generate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('treatUnmarkedAsLop') lop?: boolean) { return this.payrollRuns.generate(u, id, lop); }
  @Roles(...PAYROLL_ROLES) @Post('runs/:id/approve') approve(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.payrollRuns.approve(u, id); }
  @Roles(...PAYROLL_ROLES) @Post('runs/:id/paid') paid(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.payrollRuns.markPaid(u, id); }
  @Roles(...PAYROLL_ROLES) @Post('runs/:id/reopen') reopen(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.payrollRuns.reopen(u, id); }
  @Roles(...PAYROLL_ROLES) @Delete('runs/:id') deleteRun(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.payrollRuns.deleteRun(u, id); }

  @Roles(...PAYROLL_ROLES)
  @Get('preview')
  preview(@CurrentUser() u: AuthUser, @Query('employeeId') employeeId: string, @Query('month', ParseIntPipe) month: number, @Query('year', ParseIntPipe) year: number, @Query('treatUnmarkedAsLop') lop?: string) {
    return this.payroll.preview(u, employeeId, month, year, lop === 'true');
  }

  // ---- payslips ----
  @Get('payslips/me') mySlips(@CurrentUser() u: AuthUser) { return this.payroll.mySlips(u); }
  @Roles(...PAYROLL_ROLES) @Get('payslips/employee/:employeeId') empSlips(@CurrentUser() u: AuthUser, @Param('employeeId') employeeId: string) { return this.payroll.slipsForEmployee(u.companyId, employeeId); }

  @Get('payslips/:id/pdf')
  async slipPdf(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.reports.payslipPdf(u, id);
    send(res, filename, buffer, 'application/pdf');
  }

  @Get('payslips/:id')
  async slip(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.payroll.slipView(await this.payroll.getSlipForUser(u, id));
  }

  // ---- tax declarations ----
  @Get('tax/categories') categories() { return this.tax.categories(); }
  @Get('tax/declaration/me') myDeclaration(@CurrentUser() u: AuthUser, @Query('fy') fy?: string) { return this.tax.getMine(u, fy ? Number(fy) : undefined); }
  @Put('tax/declaration/me') saveDeclaration(@CurrentUser() u: AuthUser, @Body() dto: DeclarationDto) { return this.tax.saveMine(u, dto); }
  @Get('tax/compare') compare(@CurrentUser() u: AuthUser, @Query('fy') fy?: string) { return this.tax.compareRegimes(u, fy ? Number(fy) : undefined); }
  @Roles(...PAYROLL_ROLES) @Get('tax/declarations') declarations(@CurrentUser() u: AuthUser, @Query('fy') fy?: string, @Query('status') status?: string) { return this.tax.list(u.companyId, fy ? Number(fy) : undefined, status); }
  @Roles(...PAYROLL_ROLES) @Post('tax/declarations/:id/approve') approveDecl(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.tax.decide(u, id, true); }
  @Roles(...PAYROLL_ROLES) @Post('tax/declarations/:id/reject') rejectDecl(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.tax.decide(u, id, false); }

  @Get('tax/form16')
  async form16(@CurrentUser() u: AuthUser, @Res() res: Response, @Query('employeeId') employeeId?: string, @Query('fy') fy?: string) {
    const { buffer, filename } = await this.reports.form16(u, employeeId || u.employeeId!, fy ? Number(fy) : fiscalYearStartYear(todayIST()));
    send(res, filename, buffer, 'application/pdf');
  }

  // ---- statutory / bank reports ----
  @Roles(...READ_ALL_ROLES)
  @Get('reports/ecr')
  async ecr(@CurrentUser() u: AuthUser, @Query() q: PeriodQueryDto, @Res() res: Response) {
    const r = await this.reports.ecr(u.companyId, q.month, q.year);
    if (q.format === 'json') return res.json(r);
    send(res, `ECR_${q.year}${String(q.month).padStart(2, '0')}.txt`, r.text, 'text/plain');
  }

  @Roles(...READ_ALL_ROLES)
  @Get('reports/esi')
  async esi(@CurrentUser() u: AuthUser, @Query() q: PeriodQueryDto, @Res() res: Response) {
    const r = await this.reports.esi(u.companyId, q.month, q.year);
    if (q.format === 'json') return res.json(r);
    send(res, `ESI_${q.year}${String(q.month).padStart(2, '0')}.csv`, r.csv, 'text/csv');
  }

  @Roles(...READ_ALL_ROLES)
  @Get('reports/pt')
  async pt(@CurrentUser() u: AuthUser, @Query() q: PeriodQueryDto, @Res() res: Response) {
    const r = await this.reports.pt(u.companyId, q.month, q.year);
    if (q.format === 'json') return res.json(r);
    send(res, `PT_${q.year}${String(q.month).padStart(2, '0')}.csv`, r.csv, 'text/csv');
  }

  @Roles(...PAYROLL_ROLES)
  @Get('reports/bank-advice')
  async bank(@CurrentUser() u: AuthUser, @Query() q: PeriodQueryDto, @Res() res: Response) {
    const r = await this.reports.bankAdvice(u.companyId, q.month, q.year);
    if (q.format === 'json') return res.json(r);
    send(res, `BankAdvice_${q.year}${String(q.month).padStart(2, '0')}.csv`, r.csv, 'text/csv');
  }

  @Roles(...READ_ALL_ROLES)
  @Get('reports/register')
  async register(@CurrentUser() u: AuthUser, @Query() q: PeriodQueryDto, @Res() res: Response) {
    const r = await this.reports.register(u.companyId, q.month, q.year);
    if (q.format === 'json') return res.json(r);
    send(res, `SalaryRegister_${q.year}${String(q.month).padStart(2, '0')}.csv`, r.csv, 'text/csv');
  }

  @Roles(...READ_ALL_ROLES)
  @Get('reports/24q')
  async q24(@CurrentUser() u: AuthUser, @Query('fy', ParseIntPipe) fy: number, @Query('quarter', ParseIntPipe) quarter: number, @Query('format') format: string, @Res() res: Response) {
    const r = await this.reports.form24q(u.companyId, fy, quarter as 1 | 2 | 3 | 4);
    if (format === 'json') return res.json(r);
    send(res, `${salaryTdsLaw(fy).quarterlyReturn.replace(' ', '')}_${fy}_Q${quarter}.csv`, r.csv, 'text/csv');
  }

  @Roles(...READ_ALL_ROLES)
  @Get('reports/bonus')
  async bonus(@CurrentUser() u: AuthUser, @Query('fy', ParseIntPipe) fy: number, @Query('rate') rate: string, @Query('format') format: string, @Res() res: Response) {
    const r = await this.reports.bonus(u.companyId, fy, rate ? Number(rate) : 8.33);
    if (format === 'json') return res.json(r);
    send(res, `Bonus_FY${fy}.csv`, r.csv, 'text/csv');
  }
}
