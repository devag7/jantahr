import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { PayrollModule } from '../payroll/payroll.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [AttendanceModule, LeaveModule, PayrollModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
