import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopingExtension } from './tenant-scoping.extension';

/**
 * Single Prisma client instance, shared across the app, with our multi-tenant
 * scoping extension applied.
 *
 * Behaviour:
 *  - All reads/writes against tenant-scoped or customer-scoped models are
 *    automatically filtered by the active RequestContext actor.
 *  - To bypass scoping (super-admin reads across tenants, scheduled jobs):
 *    wrap the call in `RequestContext.withBypass(async () => { ... })`.
 *
 * The class extends PrismaClient + applies $extends in onModuleInit so that
 * NestJS can inject it the same way as a regular PrismaClient instance.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private extended: ReturnType<typeof this.$extends> | null = null;

  async onModuleInit(): Promise<void> {
    await this.$connect();
    // Build the extended client once and store it.
    this.extended = this.$extends(tenantScopingExtension());
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * The scoped client. Use this for ALL business-data access — it enforces
   * tenant/customer scoping via the extension.
   *
   * Cast intentional: Prisma's $extends return type is wide and the
   * extended client is API-compatible with PrismaClient for the methods we
   * use. If we hit an extension-only method later we'll narrow this.
   */
  get scoped(): PrismaClient {
    if (!this.extended) {
      throw new Error('PrismaService.scoped accessed before onModuleInit');
    }
    return this.extended as unknown as PrismaClient;
  }
}
