import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Job } from 'bullmq';
import { RequestContext } from '../../../common/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../push/push.service';
import type { LocalizedPushPayload, PushRecipient } from '../../push/push.types';
import {
  PUSH_DELIVERY_JOB,
  PUSH_QUEUE,
  PUSH_RECIPIENT_BATCH,
  type PushDeliveryJobData,
} from './push.constants';

/**
 * BullMQ worker that fans out a single PushNotification row to all
 * matching customer device tokens.
 *
 * Enqueued by SuperAdminPushService.create (or replayed manually by ops):
 *
 *   1. Load the PushNotification row (skip if already delivered — idempotent)
 *   2. Resolve recipients via targetType: 'all' | 'city' | 'language'.
 *      The DB filter already excludes customers without push tokens, so
 *      every row returned is deliverable.
 *   3. Iterate in PUSH_RECIPIENT_BATCH-sized cursor pages, delegating to
 *      the configured PushProvider (mock today, FCM later).
 *   4. Update sentAt + recipientsCount + deliveredCount at end.
 *
 * Failure semantics:
 *   - Per-recipient failures are tallied (deliveredCount < recipientsCount)
 *     but do NOT fail the job — they're a data point for analytics.
 *   - Transport-level failures (provider throws) DO fail the job — BullMQ
 *     retries 3× with exponential backoff per the queue's defaults.
 */
@Processor(PUSH_QUEUE)
export class PushDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(PushDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {
    super();
  }

  async process(job: Job<PushDeliveryJobData>): Promise<{
    recipients: number;
    delivered: number;
  }> {
    if (job.name !== PUSH_DELIVERY_JOB) {
      throw new Error(`Unexpected job name "${job.name}" on push-delivery queue`);
    }
    return RequestContext.withBypass(() => this.deliver(job.data.pushNotificationId));
  }

  private async deliver(pushNotificationId: string): Promise<{
    recipients: number;
    delivered: number;
  }> {
    const notification = await this.prisma.scoped.pushNotification.findUnique({
      where: { id: pushNotificationId },
    });
    if (!notification) {
      this.logger.warn(`Push ${pushNotificationId} not found — skipping (was it deleted?)`);
      return { recipients: 0, delivered: 0 };
    }
    if (notification.sentAt) {
      this.logger.warn(
        `Push ${pushNotificationId} already delivered at ${notification.sentAt.toISOString()} — skipping (idempotent)`,
      );
      return { recipients: notification.recipientsCount, delivered: notification.deliveredCount };
    }

    const payload: LocalizedPushPayload = {
      titleAz: notification.titleAz,
      titleRu: notification.titleRu,
      titleEn: notification.titleEn,
      bodyAz: notification.bodyAz,
      bodyRu: notification.bodyRu,
      bodyEn: notification.bodyEn,
    };

    const where = buildRecipientFilter(notification.targetType, notification.targetValues);

    // Cursor pagination — keeps memory flat regardless of recipient count.
    let cursor: string | undefined;
    let totalRecipients = 0;
    let totalDelivered = 0;
    const deadTokenCustomerIds: string[] = [];

    while (true) {
      const rows = await this.prisma.scoped.customer.findMany({
        where,
        take: PUSH_RECIPIENT_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          pushToken: true,
          pushPlatform: true,
          language: true,
        },
      });

      if (rows.length === 0) break;

      // Narrow types — the DB-level `not: null` filters guarantee these
      // are non-null at runtime, but the TS types from Prisma stay nullable.
      const batch: PushRecipient[] = rows.flatMap((r) =>
        r.pushToken && (r.pushPlatform === 'ios' || r.pushPlatform === 'android')
          ? [
              {
                customerId: r.id,
                pushToken: r.pushToken,
                language: r.language,
                platform: r.pushPlatform,
              },
            ]
          : [],
      );

      if (batch.length > 0) {
        const result = await this.push.sendBatch(batch, payload);
        totalRecipients += batch.length;
        totalDelivered += result.successes;
        if (result.invalidCustomerIds?.length) {
          deadTokenCustomerIds.push(...result.invalidCustomerIds);
        }
      }

      cursor = rows[rows.length - 1].id;
      if (rows.length < PUSH_RECIPIENT_BATCH) break;
    }

    // Null out tokens the provider reported as permanently dead
    // (DeviceNotRegistered) so future broadcasts don't keep targeting them.
    if (deadTokenCustomerIds.length > 0) {
      await this.prisma.scoped.customer.updateMany({
        where: { id: { in: deadTokenCustomerIds } },
        data: { pushToken: null, pushPlatform: null },
      });
      this.logger.log(
        `Cleared ${deadTokenCustomerIds.length} dead device token(s) (DeviceNotRegistered).`,
      );
    }

    // Write the per-customer IN-APP inbox rows. Independent of device push
    // (works while push is mocked) and targets ALL matched customers, not
    // just those with a registered device token.
    await this.writeInbox(notification);

    await this.prisma.scoped.pushNotification.update({
      where: { id: pushNotificationId },
      data: {
        sentAt: new Date(),
        recipientsCount: totalRecipients,
        deliveredCount: totalDelivered,
      },
    });

    this.logger.log(
      `Push ${pushNotificationId} delivered: recipients=${totalRecipients} delivered=${totalDelivered}`,
    );
    return { recipients: totalRecipients, delivered: totalDelivered };
  }

  /**
   * Insert a per-customer in-app notification row for every customer matched
   * by the broadcast's targeting — WITHOUT the push-token requirement, since
   * the in-app inbox doesn't need a device. Cursor-paginated + createMany so
   * memory stays flat for large audiences.
   */
  private async writeInbox(notification: {
    id: string;
    targetType: string;
    targetValues: string[];
    titleAz: string;
    titleRu: string;
    titleEn: string;
    bodyAz: string;
    bodyRu: string;
    bodyEn: string;
  }): Promise<void> {
    const where = buildInboxFilter(notification.targetType, notification.targetValues);
    let cursor: string | undefined;
    while (true) {
      const rows = await this.prisma.scoped.customer.findMany({
        where,
        take: PUSH_RECIPIENT_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (rows.length === 0) break;

      await this.prisma.customerNotification.createMany({
        data: rows.map((r) => ({
          customerId: r.id,
          pushNotificationId: notification.id,
          type: 'broadcast',
          titleAz: notification.titleAz,
          titleRu: notification.titleRu,
          titleEn: notification.titleEn,
          bodyAz: notification.bodyAz,
          bodyRu: notification.bodyRu,
          bodyEn: notification.bodyEn,
        })),
      });

      cursor = rows[rows.length - 1].id;
      if (rows.length < PUSH_RECIPIENT_BATCH) break;
    }
  }
}

/**
 * Compose the Prisma where clause from the targeting strategy. Always
 * applies the base filter (non-deleted + has push token + has platform).
 */
function buildRecipientFilter(
  targetType: string,
  targetValues: string[],
): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = {
    deletedAt: null,
    pushToken: { not: null },
    pushPlatform: { not: null },
  };

  switch (targetType) {
    case 'all':
      return base;
    case 'city':
      return { ...base, city: { in: targetValues } };
    case 'language':
      return {
        ...base,
        language: { in: targetValues as Array<'az' | 'ru' | 'en'> },
      };
    default:
      // Unknown targetType — return base only. Safer to deliver to all than
      // to silently no-op (which would mask a data-quality bug).
      return base;
  }
}

/**
 * Targeting filter for the in-app inbox: same city/language/all matching as
 * delivery, but WITHOUT the push-token requirement (in-app needs no device).
 */
function buildInboxFilter(
  targetType: string,
  targetValues: string[],
): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = { deletedAt: null };
  switch (targetType) {
    case 'all':
      return base;
    case 'city':
      return { ...base, city: { in: targetValues } };
    case 'language':
      return { ...base, language: { in: targetValues as Array<'az' | 'ru' | 'en'> } };
    default:
      return base;
  }
}
