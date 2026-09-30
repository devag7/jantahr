import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { CustomReportService } from './custom-report.service';
import { DashboardService } from './dashboard.service';
import { MisService } from './mis.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [AttendanceModule, LeaveModule],
  controllers: [ReportsController],
  providers: [DashboardService, MisService, CustomReportService],
})
export class ReportsModule {}
