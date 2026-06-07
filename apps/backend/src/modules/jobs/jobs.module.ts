import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UploadsModule } from '../uploads/uploads.module';
import { OrphanFileCleanupService } from './orphan-file-cleanup/orphan-file-cleanup.service';
import { SubscriptionExpiryService } from './subscription-expiry/subscription-expiry.service';

/**
 * Scheduled jobs + background processors.
 *
 * Each job lives in its own subdirectory. New cron-driven jobs are
 * registered here via `providers`. BullMQ-driven workers are registered
 * via `BullModule.registerQueue(...)` in their own feature module (so the
 * processor sits next to the producer + the domain that owns the work).
 *
 * Currently registered:
 *   - SubscriptionExpiryService — daily @ 00:05 Asia/Baku (Phase 1.8)
 *   - OrphanFileCleanupService  — daily @ 00:15 Asia/Baku (Phase 1.7 / R2)
 *
 * Coming:
 *   - EmailSendProcessor          — Phase 1.9 (Resend)
 *   - PushDeliveryProcessor       — Phase 1.10 (super-admin push composer)
 *   - HardwareCreditTimeout       — Phase 5 (hardware integration)
 */
@Module({
  imports: [ScheduleModule.forRoot(), UploadsModule],
  providers: [SubscriptionExpiryService, OrphanFileCleanupService],
  exports: [SubscriptionExpiryService, OrphanFileCleanupService],
})
export class JobsModule {}
