import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContext } from '../../common/request-context';
import { bakuStartOfDayUtc } from '../tenant-dashboard/baku-day';

/**
 * Derived tenant notifications — computed on read from live tenant
 * state, no separate Notification table needed.
 *
 * Categories surfaced:
 *  - subscription_expiring (T-7 .. T-1, amber)
 *  - subscription_today    (T-0, amber-strong)
 *  - subscription_expired  (past expiry, error)
 *  - tenant_suspended      (status='suspended', error)
 *  - hardware_error_spike  (>=3 hardware errors in the last 24h, warning)
 *
 * IDs are deterministic snapshots of the underlying state (e.g.
 * "sub-expires-2026-06-15" or "hw-error-spike-2026-05-28") so the
 * client can dismiss them locally; when the state shifts (new day, new
 * subscription period) a new id appears and the warning resurfaces.
 *
 * Severity → bell color tone on the client.
 */
@Injectable()
export class TenantNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCurrentTenant(tenantId: string): Promise<NotificationItem[]> {
    const tenant = await this.prisma.scoped.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    }

    const items: NotificationItem[] = [];
    const now = new Date();

    // 1. Suspension (most severe — call out first regardless of dates)
    if (tenant.status === 'suspended') {
      items.push({
        id: `tenant-suspended-${tenant.id}`,
        type: 'tenant_suspended',
        severity: 'error',
        occurredAt: tenant.updatedAt.toISOString(),
        data: {},
        link: '/subscription',
      });
    }

    // 2. Subscription lifecycle
    if (tenant.subscriptionEnd) {
      const end = tenant.subscriptionEnd;
      const daysLeft = diffBakuDays(now, end);
      const endDateKey = end.toISOString().slice(0, 10);
      if (daysLeft < 0) {
        items.push({
          id: `sub-expired-${endDateKey}`,
          type: 'subscription_expired',
          severity: 'error',
          occurredAt: end.toISOString(),
          data: { days: Math.abs(daysLeft).toString() },
          link: '/subscription',
        });
      } else if (daysLeft === 0) {
        items.push({
          id: `sub-today-${endDateKey}`,
          type: 'subscription_today',
          severity: 'warning',
          occurredAt: end.toISOString(),
          data: {},
          link: '/subscription',
        });
      } else if (daysLeft <= 7) {
        items.push({
          id: `sub-expiring-${endDateKey}-${daysLeft}d`,
          type: 'subscription_expiring',
          severity: 'warning',
          occurredAt: end.toISOString(),
          data: { days: daysLeft.toString() },
          link: '/subscription',
        });
      }
    }

    // 3. Hardware-error spike — last 24h Baku-time window
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hwErrorCount = await RequestContext.withBypass(() =>
      this.prisma.scoped.transaction.count({
        where: {
          tenantId,
          status: 'paid_hardware_error',
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
    );
    if (hwErrorCount >= 3) {
      // Day-bucket the id so a sustained problem gets renewed each Baku day.
      const todayKey = bakuStartOfDayUtc(now).toISOString().slice(0, 10);
      items.push({
        id: `hw-error-spike-${todayKey}`,
        type: 'hardware_error_spike',
        severity: 'warning',
        occurredAt: now.toISOString(),
        data: { count: hwErrorCount.toString() },
        link: '/transactions?status=paid_hardware_error',
      });
    }

    // Sort: severity desc (error → warning → info), then occurredAt desc.
    return items.sort((a, b) => {
      if (a.severity !== b.severity) return severityRank(b.severity) - severityRank(a.severity);
      return b.occurredAt.localeCompare(a.occurredAt);
    });
  }
}

// ─── Types ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'subscription_expiring'
  | 'subscription_today'
  | 'subscription_expired'
  | 'tenant_suspended'
  | 'hardware_error_spike';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  occurredAt: string;
  /** Variable bag for i18n interpolation (e.g. {days: "3"}). */
  data: Record<string, string>;
  /** Optional deep-link the client navigates to on click. */
  link?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function severityRank(s: NotificationSeverity): number {
  return s === 'error' ? 2 : s === 'warning' ? 1 : 0;
}

/**
 * Whole-day Baku-calendar difference (to - from). Works the same way
 * tenant-dashboard's day math does — shift +4h, slice date, compare.
 */
function diffBakuDays(from: Date, to: Date): number {
  const fromKey = new Date(from.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toKey = new Date(to.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const a = Date.UTC(
    Number(fromKey.slice(0, 4)),
    Number(fromKey.slice(5, 7)) - 1,
    Number(fromKey.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(toKey.slice(0, 4)),
    Number(toKey.slice(5, 7)) - 1,
    Number(toKey.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}
