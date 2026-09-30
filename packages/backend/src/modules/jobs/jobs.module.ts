import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { BillingModule } from '../billing/billing.module';
import { LeaveModule } from '../leave/leave.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { JobsController } from './jobs.controller';

@Module({ imports: [AttendanceModule, LeaveModule, PrivacyModule, BillingModule], controllers: [JobsController] })
export class JobsModule {}
