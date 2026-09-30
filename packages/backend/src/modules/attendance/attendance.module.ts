import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { CheckinService } from './checkin.service';
import { ShiftService } from './shift.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, CheckinService, ShiftService],
  exports: [AttendanceService, CheckinService, ShiftService],
})
export class AttendanceModule {}
