import type { Prisma } from '@prisma/client';
import type { Actor } from '../../common/actor.types';

/**
 * Models scoped by tenantId. Every business-data table that has a tenant_id column.
 * Exported for the extension AND for unit tests.
 */
export const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
  'Bay',
  'FeaturedTenant',
  'Location',
  'ServiceDisplay',
  'Subscription',
  'Tenant', // self-scoped by id == tenantId via special-case below
  'TenantPhoto',
  'TenantRefreshToken',
  'TenantUser',
  'Transaction',
]);

/**
 * Models scoped by customerId.
 *
 * Note: `Transaction` is in both sets — for a tenant actor it's tenantId-scoped,
 * for a customer actor it's customerId-scoped. `buildScopeFilter` picks the
 * right field based on actor type.
 */
export const CUSTOMER_SCOPED_MODELS = new Set<Prisma.ModelName>([
  'CustomerNotification',
  'CustomerRefreshToken',
  'Favorite',
  'SavedCard',
  'Transaction',
]);

/**
 * For a given (model, actor) pair, return the `where` filter that the
 * Prisma extension should inject — or null if no scoping applies.
 *
 * Pure function, no I/O — trivially unit-testable.
 *
 * Rules (in priority order):
 *   1. super_admin → no scoping (sees all)
 *   2. tenant actor + tenant-scoped model → { tenantId: actor.tenantId }
 *      (plus a few special cases for self-table and relation tables)
 *   3. customer actor + customer-scoped model → { customerId: actor.id }
 *   4. wrong-actor-for-model → impossible filter `{ id: '__deny__' }`
 *      (defense-in-depth: deny rather than fail open)
 *   5. anonymous + protected model → impossible filter
 *   6. otherwise → null (no scoping needed)
 */
export function buildScopeFilter(
  model: Prisma.ModelName,
  actor: Actor,
): Record<string, unknown> | null {
  if (actor.type === 'super_admin') return null;

  if (actor.type === 'tenant') {
    if (!TENANT_SCOPED_MODELS.has(model)) {
      // Tenant-scoped sessions cannot read customer-scoped tables.
      if (CUSTOMER_SCOPED_MODELS.has(model)) {
        return { id: '__deny__' };
      }
      return null;
    }
    // The Tenant table itself: tenant can only see their own row.
    if (model === 'Tenant') return { id: actor.tenantId };
    // TenantRefreshToken is scoped via its `user` relation rather than a
    // direct tenantId column.
    if (model === 'TenantRefreshToken') {
      return { user: { is: { tenantId: actor.tenantId } } };
    }
    return { tenantId: actor.tenantId };
  }

  if (actor.type === 'customer') {
    if (!CUSTOMER_SCOPED_MODELS.has(model)) {
      // Customer sessions cannot read tenant-scoped tables (except Tenant
      // itself, which has public-facing queries via withBypass).
      if (TENANT_SCOPED_MODELS.has(model) && model !== 'Tenant') {
        return { id: '__deny__' };
      }
      return null;
    }
    return { customerId: actor.id };
  }

  // Anonymous: deny reads on any protected model. Public endpoints must
  // explicitly opt out via RequestContext.withBypass().
  if (TENANT_SCOPED_MODELS.has(model) || CUSTOMER_SCOPED_MODELS.has(model)) {
    return { id: '__deny__' };
  }
  return null;
}
