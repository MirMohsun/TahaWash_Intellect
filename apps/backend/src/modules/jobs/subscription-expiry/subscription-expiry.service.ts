import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { RequestContext } from '../../../common/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { classifySubscriptionWindow, type SubscriptionWindow } from './subscription-window.logic';

/**
 * Daily subscription-expiry check.
 *
 * Cron fires at 00:05 Asia/Baku (5-min buffer so we're firmly on the next
 * calendar day in every timezone). For each tenant with a configured
 * `subscriptionEnd`, classify against the four spec'd notice windows
 * (T-7 / T-1 / T-0 / T+7) and act:
 *
 *   T-7, T-1, T-0  → log a system AuditLog row. Email + push delivery
 *                    is wired by Phase 1.9 (Resend) and Phase 1.10
 *                    (super-admin push composer). Once those land, this
 *                    same loop also enqueues the notification jobs.
 *
 *   T+7            → auto-suspend the tenant if currently active
 *                    (status='suspended'). Also writes an AuditLog row.
 *
 * Idempotency: re-running on the same calendar day produces no new state
 * change for already-suspended tenants. Notice rows are duplicated on
 * re-run — acceptable for an audit log (they're scoped by createdAt) and
 * harmless because notifications won't be sent twice (Phase 1.9/1.10 will
 * dedupe by `(tenantId, window, calendarDay)`).
 */
@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('5 0 * * *', {
    name: 'subscription-expiry-daily',
    timeZone: 'Asia/Baku',
  })
  async dailyCron(): Promise<void> {
    this.logger.log('Running daily subscription-expiry check');
    try {
      // No actor in a cron context — withBypass lets the scheduled run
      // see ALL tenants (not just one tenant's view).
      const result = await RequestContext.withBypass(() => this.runCheck(new Date()));
      this.logger.log(
        `Subscription-expiry done: checked=${result.checked} notices=${result.notices} suspended=${result.suspended}`,
      );
    } catch (err) {
      // Log and re-throw — Nest will surface to whatever observability we wire (Sentry, Phase 0.11).
      this.logger.error('Subscription-expiry cron failed', err as Error);
      throw err;
    }
  }

  /**
   * Pure-ish entry point usable from a unit/integration test or a manual
   * super-admin "run now" trigger (to be added in Phase 1.10).
   */
  async runCheck(now: Date): Promise<{
    checked: number;
    notices: number;
    suspended: number;
  }> {
    const tenants = await this.prisma.scoped.tenant.findMany({
      where: { deletedAt: null, subscriptionEnd: { not: null } },
      select: {
        id: true,
        brandName: true,
        status: true,
        subscriptionEnd: true,
      },
    });

    let notices = 0;
    let suspended = 0;

    for (const t of tenants) {
      const window = classifySubscriptionWindow(t.subscriptionEnd, now);
      if (!window) continue;

      if (window === 't_plus_7') {
        if (t.status === 'active') {
          await this.prisma.scoped.tenant.update({
            where: { id: t.id },
            data: { status: 'suspended' },
          });
          await this.writeAudit(t.id, 'subscription.auto_suspended', {
            previousStatus: t.status,
            reason: 'grace_period_expired',
          });
          suspended++;
          this.logger.warn(
            `Tenant ${t.brandName} (${t.id}) auto-suspended (T+7 grace period expired)`,
          );
        }
        // Already suspended → no-op, idempotent.
      } else {
        await this.writeNotice(t.id, window);
        notices++;
        this.logger.log(
          `Subscription notice ${window} recorded for tenant ${t.brandName} (${t.id})`,
        );
      }
    }

    return { checked: tenants.length, notices, suspended };
  }

  private async writeNotice(tenantId: string, window: SubscriptionWindow): Promise<void> {
    await this.writeAudit(tenantId, `subscription.notice.${window}`, { window });
  }

  private async writeAudit(
    tenantId: string,
    action: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.scoped.auditLog.create({
      data: {
        actorType: 'system',
        actorId: null,
        action,
        resourceType: 'tenant',
        resourceId: tenantId,
        changes: changes as Prisma.InputJsonValue,
        ipAddress: null,
        userAgent: null,
      },
    });
  }
}
