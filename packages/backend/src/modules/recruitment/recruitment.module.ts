import { Module } from '@nestjs/common';
import { CoreHrModule } from '../core-hr/core-hr.module';
import { PublicCareersController, RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';

@Module({ imports: [CoreHrModule], controllers: [RecruitmentController, PublicCareersController], providers: [RecruitmentService] })
export class RecruitmentModule {}
