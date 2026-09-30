import { Module } from '@nestjs/common';
import { PayProfileService } from './runs/pay-profile.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './runs/payroll.service';
import { PayrollRunService } from './runs/payroll-run.service';
import { TdsService } from './tax/tds.service';
import { PdfService } from './reports/pdf.service';
import { SalarySetupService } from './setup/salary-setup.service';
import { StatutoryReportsService } from './reports/statutory-reports.service';
import { TaxDeclarationService } from './tax/tax-declaration.service';

@Module({
  controllers: [PayrollController],
  providers: [PayProfileService, PayrollService, PayrollRunService, TdsService, SalarySetupService, StatutoryReportsService, TaxDeclarationService, PdfService],
  exports: [PayProfileService, PayrollService, PayrollRunService, SalarySetupService, TaxDeclarationService],
})
export class PayrollModule {}
