import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { EngagementController } from './announcements/engagement.controller';
import { EngagementService } from './announcements/engagement.service';
import { CompanyController } from './company/company.controller';
import { CompanyService } from './company/company.service';
import { CompanySetupService } from './company-setup.service';
import { OrgController } from './departments/org.controller';
import { OrgService } from './departments/org.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { HolidaysController } from './holidays/holidays.controller';
import { HolidaysService } from './holidays/holidays.service';

@Module({
  imports: [LeaveModule, LifecycleModule],
  controllers: [EmployeesController, OrgController, CompanyController, HolidaysController, EngagementController],
  providers: [EmployeesService, OrgService, CompanyService, CompanySetupService, HolidaysService, EngagementService],
  exports: [CompanySetupService, CompanyService, EmployeesService, HolidaysService],
})
export class CoreHrModule {}
