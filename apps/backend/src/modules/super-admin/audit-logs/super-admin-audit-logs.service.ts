import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/**
 * Read-only super-admin view over the AuditLog table.
 *
 * Audit rows are written from many places — super-admin actions (tenant
 * suspend, promo create, etc.), tenant self-management actions, and
 * system jobs (subscription cron auto-suspending tenants, etc.). This
 * service is just the query side; writes happen at the action source.
 *
 * Filter set chosen to match the most common ops use case:
 *   "what did super-admin X do today?"      — actorType + actorId + date
 *   "what happened to tenant Y this week?"  — resourceType + resourceId + date
 *   "show me all subscription state changes" — action prefix
 */
@Injectable()
export class SuperAdminAuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorType) where.actorType = query.actorType;
    if (query.actorId) where.actorId = query.actorId;
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.action) {
      // Prefix match — e.g. "subscription." catches every subscription.* action.
      where.action = { startsWith: query.action };
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.scoped.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.scoped.auditLog.count({ where }),
    ]);

    return {
      items: items.map(serializeAuditLog),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.scoped.auditLog.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'AUDIT_LOG_NOT_FOUND' });
    }
    return serializeAuditLog(row);
  }
}

function serializeAuditLog(a: {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    actorType: a.actorType,
    actorId: a.actorId,
    action: a.action,
    resourceType: a.resourceType,
    resourceId: a.resourceId,
    changes: a.changes,
    ipAddress: a.ipAddress,
    userAgent: a.userAgent,
    createdAt: a.createdAt.toISOString(),
  };
}
