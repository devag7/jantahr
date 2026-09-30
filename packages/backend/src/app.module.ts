import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AuthGuard } from './common/guards/auth.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditTrailInterceptor } from './common/interceptors/audit-trail.interceptor';
import { HealthController } from './health/health.controller';
import { AiModule } from './modules/ai/ai.module';
import { BillingModule } from './modules/billing/billing.module';
import { EntitlementsModule } from './modules/billing/entitlements.module';
import { FeatureGuard } from './modules/billing/feature.guard';
import { JobsModule } from './modules/jobs/jobs.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.service';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { CoreHrModule } from './modules/core-hr/core-hr.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { HelpdeskModule } from './modules/helpdesk/helpdesk.module';
import { LeaveModule } from './modules/leave/leave.module';
import { LifecycleModule } from './modules/lifecycle/lifecycle.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => {
        if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) throw new Error('JWT_SECRET must be set (min 16 chars)');
        if (!env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
        return env;
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    PrismaModule,
    CommonModule,
    EntitlementsModule,
    SupabaseModule,
    IdentityModule,
    CalendarModule,
    NotificationsModule,
    AuthModule,
    CoreHrModule,
    LeaveModule,
    AttendanceModule,
    PayrollModule,
    LifecycleModule,
    PerformanceModule,
    ExpensesModule,
    HelpdeskModule,
    PrivacyModule,
    ComplianceModule,
    RecruitmentModule,
    ReportsModule,
    AiModule,
    BillingModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditTrailInterceptor },
  ],
})
export class AppModule {}
