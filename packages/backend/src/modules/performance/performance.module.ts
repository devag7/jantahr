import { Module } from '@nestjs/common';
import { PayrollModule } from '../payroll/payroll.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({ imports: [PayrollModule], controllers: [PerformanceController], providers: [PerformanceService] })
export class PerformanceModule {}
