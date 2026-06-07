import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import type { CreatePushDto } from './dto/create-push.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PUSH_DELIVERY_JOB, PUSH_QUEUE, type PushDeliveryJobData } from './push.constants';

/**
 * Super-admin push composer + history.
 *
 * `create` validates targeting, writes a PushNotification row, and
 * enqueues a delivery job in the BullMQ `push-delivery` queue. The
 * `PushDeliveryProcessor` does the fan-out (potentially minutes later
 * if `scheduledFor` is in the future).
 *
 * The PushNotification row is the source of truth: status fields
 * (`sentAt`, `recipientsCount`, `deliveredCount`) are written by the
 * worker as it processes. Super-admins read this back via `list`.
 */
@Injectable()
export class SuperAdminPushService {
  private readonly logger = new Logger(SuperAdminPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PUSH_QUEUE) private readonly queue: Queue<PushDeliveryJobData>,
  ) {}

  async create(dto: CreatePushDto) {
    // 1. Validate scheduledFor (must be future if set)
    let scheduledFor: Date | null = null;
    if (dto.scheduledFor) {
      scheduledFor = new Date(dto.scheduledFor);
      if (scheduledFor.getTime() <= Date.now()) {
        throw new BadRequestException({
          code: 'SCHEDULED_FOR_IN_PAST',
          message: 'scheduledFor must be in the future. Omit the field to send immediately.',
        });
      }
    }

    // 2. Validate targetValues consistency
    if (dto.targetType === 'all' && dto.targetValues && dto.targetValues.length > 0) {
      // Tolerate but ignore — superseded by 'all'. Could also reject; the
      // friendlier path is to discard silently.
    }
    if (dto.targetType === 'language') {
      const allowed = new Set(['az', 'ru', 'en']);
      for (const v of dto.targetValues ?? []) {
        if (!allowed.has(v)) {
          throw new BadRequestException({
            code: 'INVALID_TARGET_LANGUAGE',
            message: `Unknown language code "${v}". Allowed: az, ru, en.`,
          });
        }
      }
    }

    // 3. Create the DB row
    const row = await this.prisma.scoped.pushNotification.create({
      data: {
        titleAz: dto.titleAz,
        titleRu: dto.titleRu,
        titleEn: dto.titleEn,
        bodyAz: dto.bodyAz,
        bodyRu: dto.bodyRu,
        bodyEn: dto.bodyEn,
        targetType: dto.targetType,
        targetValues: dto.targetType === 'all' ? [] : (dto.targetValues ?? []),
        scheduledFor,
      },
    });

    // 4. Enqueue delivery job (delayed if scheduledFor in the future).
    // Surface the real reason if the Redis enqueue fails, instead of a bare
    // 500 — the message lands in the API response + the server log.
    const delay = scheduledFor ? Math.max(0, scheduledFor.getTime() - Date.now()) : 0;
    try {
      await this.queue.add(
        PUSH_DELIVERY_JOB,
        { pushNotificationId: row.id },
        {
          delay,
          // Dedupe key: re-enqueuing the same notification id won't double-add
          // while pending. NOTE: BullMQ forbids ':' in a custom jobId (it's the
          // internal Redis key separator) — use '-', not 'push:<id>'.
          jobId: `push-${row.id}`,
        },
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Push ${row.id} enqueue failed (Redis): ${reason}`, (err as Error)?.stack);
      throw new ServiceUnavailableException({
        code: 'PUSH_ENQUEUE_FAILED',
        message: `Could not queue delivery (Redis): ${reason}`,
      });
    }

    this.logger.log(
      `Push ${row.id} created (target=${row.targetType}, ` +
        `scheduled=${scheduledFor?.toISOString() ?? 'immediate'}). Delivery job enqueued.`,
    );

    return serializePush(row);
  }

  async list(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.scoped.pushNotification.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.scoped.pushNotification.count(),
    ]);
    return {
      items: items.map(serializePush),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.scoped.pushNotification.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'PUSH_NOT_FOUND' });
    }
    return serializePush(row);
  }

  /**
   * Distinct Customer.city values across the platform with counts.
   * Excludes nulls, soft-deleted customers, and customers without a
   * push token (we can't notify them anyway — surfacing them in the
   * target picker would be misleading).
   */
  async listCities() {
    const grouped = await this.prisma.scoped.customer.groupBy({
      by: ['city'],
      where: {
        deletedAt: null,
        city: { not: null },
        pushToken: { not: null },
      },
      _count: { _all: true },
    });

    return {
      items: grouped
        .filter((g): g is typeof g & { city: string } => g.city !== null)
        .map((g) => ({ city: g.city, customerCount: g._count._all }))
        .sort((a, b) => b.customerCount - a.customerCount),
    };
  }
}

function serializePush(p: {
  id: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  targetType: string;
  targetValues: string[];
  scheduledFor: Date | null;
  sentAt: Date | null;
  recipientsCount: number;
  deliveredCount: number;
  createdAt: Date;
}) {
  return {
    id: p.id,
    titleAz: p.titleAz,
    titleRu: p.titleRu,
    titleEn: p.titleEn,
    bodyAz: p.bodyAz,
    bodyRu: p.bodyRu,
    bodyEn: p.bodyEn,
    targetType: p.targetType,
    targetValues: p.targetValues,
    scheduledFor: p.scheduledFor?.toISOString() ?? null,
    sentAt: p.sentAt?.toISOString() ?? null,
    recipientsCount: p.recipientsCount,
    deliveredCount: p.deliveredCount,
    createdAt: p.createdAt.toISOString(),
    status: deriveStatus(p),
  };
}

function deriveStatus(p: {
  scheduledFor: Date | null;
  sentAt: Date | null;
}): 'queued' | 'scheduled' | 'sent' {
  if (p.sentAt) return 'sent';
  if (p.scheduledFor && p.scheduledFor.getTime() > Date.now()) return 'scheduled';
  return 'queued';
}
