import { RequiresFeature } from '../billing/feature.guard';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ADMIN_ROLES, APPROVER_ROLES, AuthUser, READ_ALL_ROLES } from '../../common/types';
import { CustomReportDto, CustomReportService } from './custom-report.service';
import { DashboardService } from './dashboard.service';
import { MIS_CATALOG, MisService } from './mis.service';

@Controller('reports')
export class ReportsController {
  constructor(private dashboards: DashboardService, private mis: MisService, private custom: CustomReportService) {}

  @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES) @Get('dashboard/admin') admin(@CurrentUser() u: AuthUser) { return this.dashboards.admin(u); }
  @Roles(...APPROVER_ROLES) @Get('dashboard/manager') manager(@CurrentUser() u: AuthUser) { return this.dashboards.manager(u); }
  @Get('dashboard/ess') ess(@CurrentUser() u: AuthUser) { return this.dashboards.ess(u); }

  @RequiresFeature('analytics') @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES) @Get('mis') catalog() { return MIS_CATALOG; }

  @RequiresFeature('analytics')
  @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES)
  @Get('mis/:key')
  async run(@CurrentUser() u: AuthUser, @Param('key') key: string, @Query() q: Record<string, string>, @Res() res: Response) {
    const report = await this.mis.run(u, key, q);
    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${key}.csv"`);
      return res.send(this.mis.toCsv(report));
    }
    return res.json(report);
  }

  @RequiresFeature('analytics') @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES) @Get('custom/catalog') customCatalog(@CurrentUser() u: AuthUser) { return this.custom.catalog(u); }

  @RequiresFeature('analytics')
  @Roles(...ADMIN_ROLES, ...READ_ALL_ROLES)
  @Post('custom')
  async customRun(@CurrentUser() u: AuthUser, @Body() dto: CustomReportDto, @Res() res: Response) {
    const r = await this.custom.run(u, { ...dto, format: dto.format });
    if (dto.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${dto.entity}-report.csv"`);
      return res.send(r.csv);
    }
    return res.json(r);
  }
}
