import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module';
import { PayrollModule } from '../payroll/payroll.module';
import { LifecycleController } from './lifecycle.controller';
import { OnboardingService } from './onboarding.service';
import { SeparationService } from './separation.service';

@Module({
  imports: [PayrollModule, LeaveModule],
  controllers: [LifecycleController],
  providers: [OnboardingService, SeparationService],
  exports: [OnboardingService],
})
export class LifecycleModule {}
