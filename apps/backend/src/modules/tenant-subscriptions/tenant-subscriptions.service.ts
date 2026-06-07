import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tenant subscription history — exposes the manual Subscription rows
 * super-admin records when a tenant pays for a period.
 *
 * The Subscription model (see schema.prisma) is a payment LOG, not the
 * current-period truth — that lives on Tenant.subscriptionStart/End
 * which super-admin extends as payments come in. So this list is
 * historical: "here's every period you've paid for, when, how much,
 * how." The active-period info still surfaces via /tenant/me.
 *
 * Multi-tenancy: prisma.scoped auto-filters by actor.tenantId; a tenant
 * can never see another tenant's payment log.
 */
@Injectable()
export class TenantSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCurrentTenant() {
    const rows = await this.prisma.scoped.subscription.findMany({
      orderBy: { paidAt: 'desc' },
    });
    return rows.map(serialize);
  }
}

function serialize(s: {
  id: string;
  amountAzn: Prisma.Decimal;
  paidAt: Date;
  periodStart: Date;
  periodEnd: Date;
  method: string;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: s.id,
    amountAzn: s.amountAzn.toString(),
    paidAt: s.paidAt.toISOString(),
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    method: s.method,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}
