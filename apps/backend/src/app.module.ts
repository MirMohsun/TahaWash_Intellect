import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestContextInterceptor } from './common/request-context.interceptor';
import { validateEnv } from './config/env.schema';
import { AuthModule } from './modules/auth/auth.module';
import { HardwareModule } from './modules/hardware/hardware.module';
import { HardwareAdminModule } from './modules/hardware-admin/hardware-admin.module';
import { BaysModule } from './modules/bays/bays.module';
import { CustomersModule } from './modules/customers/customers.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LocationsModule } from './modules/locations/locations.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PublicModule } from './modules/public/public.module';
import { PushModule } from './modules/push/push.module';
import { QueueModule } from './modules/queue/queue.module';
import { SmsModule } from './modules/sms/sms.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { TenantDashboardModule } from './modules/tenant-dashboard/tenant-dashboard.module';
import { TenantFinancialsModule } from './modules/tenant-financials/tenant-financials.module';
import { TenantNotificationsModule } from './modules/tenant-notifications/tenant-notifications.module';
import { TenantSubscriptionsModule } from './modules/tenant-subscriptions/tenant-subscriptions.module';
import { TenantTransactionsModule } from './modules/tenant-transactions/tenant-transactions.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),

    // Global rate limiting baseline (60 req / min / IP).
    // Auth routes set tighter @Throttle decorators on top of this.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    PrismaModule,
    HardwareModule,
    HardwareAdminModule,
    SmsModule,
    PushModule,
    EmailModule,
    QueueModule,
    AuthModule,
    TenantsModule,
    TenantDashboardModule,
    TenantTransactionsModule,
    TenantFinancialsModule,
    TenantSubscriptionsModule,
    TenantNotificationsModule,
    LocationsModule,
    BaysModule,
    SuperAdminModule,
    PublicModule,
    CustomersModule,
    JobsModule,
    HealthModule,
    UploadsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global interceptor wraps every request in an AsyncLocalStorage actor
    // context. The Prisma scoping extension reads from this context to
    // auto-filter tenant/customer-scoped queries. See common/request-context.ts.
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
