import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminSubscriptionsController } from './super-admin-subscriptions.controller';
import { SuperAdminSubscriptionsService } from './super-admin-subscriptions.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminSubscriptionsController],
  providers: [SuperAdminSubscriptionsService],
})
export class SuperAdminSubscriptionsModule {}
