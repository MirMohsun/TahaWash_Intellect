import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantSubscriptionsController } from './tenant-subscriptions.controller';
import { TenantSubscriptionsService } from './tenant-subscriptions.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantSubscriptionsController],
  providers: [TenantSubscriptionsService],
})
export class TenantSubscriptionsModule {}
