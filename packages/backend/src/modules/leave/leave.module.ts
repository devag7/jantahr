import { Module } from '@nestjs/common';
import { PayrollModule } from '../payroll/payroll.module';
import { LeaveAdminService } from './leave-admin.service';
import { LeaveAllocationService } from './leave-allocation.service';
import { LeaveApplicationService } from './leave-application.service';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveController } from './leave.controller';

@Module({
  imports: [PayrollModule],
  controllers: [LeaveController],
  providers: [LeaveAdminService, LeaveAllocationService, LeaveApplicationService, LeaveBalanceService],
  exports: [LeaveAllocationService, LeaveBalanceService],
})
export class LeaveModule {}
