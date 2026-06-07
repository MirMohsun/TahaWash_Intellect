import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminAnalyticsController } from './super-admin-analytics.controller';
import { SuperAdminAnalyticsService } from './super-admin-analytics.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminAnalyticsController],
  providers: [SuperAdminAnalyticsService],
})
export class SuperAdminAnalyticsModule {}
