import { Module } from '@nestjs/common';
import { BreachService } from './breach.service';
import { DataExportService } from './data-export.service';
import { ErasureService } from './erasure.service';
import { PrivacyHousekeepingService } from './privacy-housekeeping.service';
import { PrivacyRequestsService } from './privacy-requests.service';
import { PrivacyController } from './privacy.controller';

@Module({
  controllers: [PrivacyController],
  providers: [PrivacyRequestsService, BreachService, DataExportService, ErasureService, PrivacyHousekeepingService],
  exports: [PrivacyHousekeepingService],
})
export class PrivacyModule {}
