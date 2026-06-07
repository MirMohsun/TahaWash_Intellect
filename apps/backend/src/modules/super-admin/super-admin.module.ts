import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SuperAdminAnalyticsModule } from './analytics/super-admin-analytics.module';
import { SuperAdminAuditLogsModule } from './audit-logs/super-admin-audit-logs.module';
import { SuperAdminDashboardModule } from './dashboard/super-admin-dashboard.module';
import { SuperAdminFeaturedModule } from './featured/super-admin-featured.module';
import { SuperAdminLegalModule } from './legal/super-admin-legal.module';
import { SuperAdminPromosModule } from './promos/super-admin-promos.module';
import { SuperAdminPushModule } from './push/super-admin-push.module';
import { SuperAdminSettingsModule } from './settings/super-admin-settings.module';
import { SuperAdminSubscriptionsModule } from './subscriptions/super-admin-subscriptions.module';
import { SuperAdminTenantsController } from './tenants/super-admin-tenants.controller';
import { SuperAdminTenantsService } from './tenants/super-admin-tenants.service';
import { SuperAdminVersionModule } from './version/super-admin-version.module';

/**
 * Super-admin facing endpoints. Every controller in this umbrella module
 * sits under /super-admin/* and is guarded by SuperAdminAuthGuard.
 *
 * Sub-modules (one per resource) own their own controllers + services so
 * they can also bring in their own BullMQ queues without forcing this
 * top-level module to know about queues.
 */
@Module({
  imports: [
    AuthModule,
    SuperAdminDashboardModule,
    SuperAdminSubscriptionsModule,
    SuperAdminAnalyticsModule,
    SuperAdminPushModule,
    SuperAdminPromosModule,
    SuperAdminFeaturedModule,
    SuperAdminSettingsModule,
    SuperAdminAuditLogsModule,
    SuperAdminVersionModule,
    SuperAdminLegalModule,
  ],
  controllers: [SuperAdminTenantsController],
  providers: [SuperAdminTenantsService],
})
export class SuperAdminModule {}
