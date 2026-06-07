import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PushModule } from '../../push/push.module';
import { PushDeliveryProcessor } from './push-delivery.processor';
import { PUSH_QUEUE } from './push.constants';
import { SuperAdminPushController } from './super-admin-push.controller';
import { SuperAdminPushService } from './super-admin-push.service';

/**
 * Super-admin bulk push: composer endpoint + history + BullMQ worker.
 *
 * Registers the `push-delivery` queue against the BullMQ root configured
 * in QueueModule (apps/backend/src/modules/queue). Producer is the
 * service; consumer is PushDeliveryProcessor (lives in this same module
 * so it scales with whatever process the API runs in — Phase 1
 * single-instance design; split into a dedicated worker process in
 * Phase 8+ if needed).
 */
@Module({
  imports: [AuthModule, PushModule, BullModule.registerQueue({ name: PUSH_QUEUE })],
  controllers: [SuperAdminPushController],
  providers: [SuperAdminPushService, PushDeliveryProcessor],
})
export class SuperAdminPushModule {}
