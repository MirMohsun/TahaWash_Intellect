import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantNotificationsController } from './tenant-notifications.controller';
import { TenantNotificationsService } from './tenant-notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantNotificationsController],
  providers: [TenantNotificationsService],
})
export class TenantNotificationsModule {}
