import { Prisma } from '@prisma/client';
import { RequestContext } from '../../common/request-context';
import { buildScopeFilter } from './tenant-scoping.logic';

/**
 * Multi-tenant scoping — Prisma client extension.
 *
 * Auto-injects `where` clauses based on the active RequestContext actor:
 *  - tenant actor      → `tenantId = actor.tenantId` on tenant-scoped models
 *  - customer actor    → `customerId = actor.id` on customer-scoped models
 *  - super_admin actor → no scoping (full visibility)
 *  - anonymous actor   → impossible filter on protected models (zero rows)
 *
 * Bypass (super-admin reads, pre-auth lookups, scheduled jobs):
 *   `RequestContext.withBypass(async () => { ... })`.
 *
 * The scoping decision logic lives in `tenant-scoping.logic.ts` so it's
 * unit-testable without a real DB.
 *
 * ─── Two operation categories ─────────────────────────────────────
 *
 * Group A — operations using `WhereInput` (supports `AND`):
 *   findFirst, findFirstOrThrow, findMany, count, aggregate, groupBy,
 *   updateMany, deleteMany.
 *
 *   The extension wraps the user's `where` as
 *   `{ AND: [user_where, scope_filter] }`. Works directly.
 *
 * Group B — operations using `WhereUniqueInput` (NO `AND` allowed):
 *   findUnique, findUniqueOrThrow, update, delete.
 *
 *   `WhereUniqueInput` only accepts specific unique-field shapes. Wrapping
 *   with `AND` raises `PrismaClientValidationError` at runtime
 *   (BACKEND_PATTERNS §26). So for these ops the extension does a pre-check:
 *     1. Call `findFirst({ where: AND[user_where, scope_filter] })` on
 *        the underlying client (not the extended one) to confirm the
 *        target row is in the actor's scope.
 *     2. If found: proceed with the original op + ORIGINAL where (no wrap).
 *     3. If not found: return `null` (findUnique) OR throw P2025
 *        "record not found" (findUniqueOrThrow / update / delete).
 *
 *   This costs one extra read per write — acceptable at MVP scale and
 *   safer than removing scoping from these ops entirely.
 *
 * ─── Excluded entirely ───────────────────────────────────────────
 *
 * `upsert` is left for the caller to scope. The semantics are tricky
 * (if the row exists in another scope, do we update it or create a new
 * one?) and our current upsert call sites are all on actors that bypass
 * scoping (super-admin) OR on composite keys that include the scoping
 * field (e.g. Favorite's customerId_tenantId).
 */

const GROUP_A_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const GROUP_B_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);

// `upsert` is intentionally NOT in either set.

/**
 * Convert a model name like `TenantUser` to its lowercase-first key
 * used on the Prisma client: `tenantUser`.
 */
function modelClientKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Build a P2025-style error mimicking Prisma's behavior when a unique
 * lookup misses. Some Prisma versions don't export
 * `PrismaClientKnownRequestError`'s constructor cleanly, so we throw a
 * regular Error with the `code` attached — service code handles either
 * shape.
 */
function rowNotInScopeError(model: string, operation: string): Error {
  const err = new Error(
    `An operation failed because it depends on one or more records that were required but not found. ` +
      `${operation} on ${model}: row does not exist in the current actor's scope.`,
  );
  (err as { code?: string }).code = 'P2025';
  return err;
}

export function tenantScopingExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tahawash-tenant-scoping',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (RequestContext.isScopingBypassed()) {
              return query(args);
            }

            const inGroupA = GROUP_A_OPS.has(operation);
            const inGroupB = GROUP_B_OPS.has(operation);
            if (!inGroupA && !inGroupB) {
              // Not a scoped op (e.g. create, upsert, $queryRaw). Pass through.
              return query(args);
            }

            const actor = RequestContext.current();
            const scopeWhere = buildScopeFilter(model as Prisma.ModelName, actor);
            if (!scopeWhere) return query(args);

            const argsAny = args as { where?: Record<string, unknown> } & typeof args;
            const userWhere = argsAny.where;

            // ─── Group A: AND-wrap the where (WhereInput supports it) ──
            if (inGroupA) {
              argsAny.where = userWhere ? { AND: [userWhere, scopeWhere] } : scopeWhere;
              return query(args);
            }

            // ─── Group B: WhereUniqueInput — pre-check + proceed ──────
            // We hit the raw `client` (the pre-extended one closed-over by
            // `defineExtension`) so this findFirst does NOT recurse back
            // through this extension. We pass the AND-wrapped where here
            // because findFirst accepts WhereInput.
            const checkWhere = userWhere ? { AND: [userWhere, scopeWhere] } : scopeWhere;
            const key = modelClientKey(model);
            // Tight runtime type. The `as` cast is unavoidable since `client`
            // is typed as the base client and we want to dispatch on a
            // dynamic model key.
            const modelClient = (
              client as unknown as Record<string, { findFirst: (a: unknown) => Promise<unknown> }>
            )[key];
            const found = await modelClient.findFirst({ where: checkWhere });

            if (!found) {
              if (operation === 'findUnique') return null;
              throw rowNotInScopeError(model, operation);
            }

            // In-scope — proceed with the original op untouched.
            return query(args);
          },
        },
      },
    }),
  );
}
