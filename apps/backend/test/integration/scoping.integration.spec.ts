import type { PrismaClient } from '@prisma/client';
import type { Actor } from '../../src/common/actor.types';
import { RequestContext } from '../../src/common/request-context';
import { createTestPrismaClients, type TestPrismaClients } from './helpers/prisma-test-client';
import { resetDb } from './helpers/reset-db';
import { seedScopingFixture, type ScopingFixture } from './helpers/fixtures';

/**
 * Integration tests — multi-tenancy scoping behavior end-to-end.
 *
 * Hits a real Postgres + PostGIS DB (tahawash_test). Exercises the
 * scoping extension as production uses it: via `RequestContext.run()`
 * to set an actor and `prisma.scoped.*` to query.
 *
 * Why these tests exist (BACKEND_PATTERNS §26): the first Railway deploy
 * surfaced two related bugs in the scoping extension that unit tests
 * couldn't catch — the extension's actual mutation of query args is
 * runtime behavior, not pure logic. These tests lock in the behavior
 * we shipped after that incident.
 *
 * Each test runs inside `RequestContext.run(actor, ...)` to simulate
 * a real request. The DB is truncated + re-seeded once at the start
 * of the suite; individual tests are READ-ONLY so order doesn't matter.
 */
describe('Multi-tenancy scoping (integration)', () => {
  let clients: TestPrismaClients;
  let raw: PrismaClient;
  let scoped: PrismaClient;
  let fx: ScopingFixture;

  // Actor fixtures — typed shapes that RequestContext.run accepts.
  let actorA: Actor;
  let actorB: Actor;
  let actorElvin: Actor;
  let actorSuperAdmin: Actor;

  beforeAll(async () => {
    clients = await createTestPrismaClients();
    raw = clients.raw;
    scoped = clients.scoped;

    await resetDb(raw);
    fx = await seedScopingFixture(raw);

    actorA = {
      type: 'tenant',
      id: fx.tenantA.userId,
      tenantId: fx.tenantA.tenantId,
      username: 'tenanta',
    };
    actorB = {
      type: 'tenant',
      id: fx.tenantB.userId,
      tenantId: fx.tenantB.tenantId,
      username: 'tenantb',
    };
    actorElvin = { type: 'customer', id: fx.customers.elvinId, phone: '+994500000003' };
    actorSuperAdmin = { type: 'super_admin', id: fx.superAdmin.id, username: 'test-admin' };
  });

  afterAll(async () => {
    await clients.disconnect();
  });

  // ──────────────────────────────────────────────────────────────
  // findMany — the primary scoping surface
  // ──────────────────────────────────────────────────────────────

  describe('findMany — primary scoped operation', () => {
    it('tenant A actor sees ONLY tenant A bays (never tenant B)', async () => {
      const bays = await RequestContext.run(actorA, () => scoped.bay.findMany());
      expect(bays.length).toBe(2);
      expect(bays.every((b) => b.tenantId === fx.tenantA.tenantId)).toBe(true);
      expect(bays.some((b) => b.tenantId === fx.tenantB.tenantId)).toBe(false);
    });

    it('tenant B actor sees ONLY tenant B bays (never tenant A)', async () => {
      const bays = await RequestContext.run(actorB, () => scoped.bay.findMany());
      expect(bays.length).toBe(2);
      expect(bays.every((b) => b.tenantId === fx.tenantB.tenantId)).toBe(true);
      expect(bays.some((b) => b.tenantId === fx.tenantA.tenantId)).toBe(false);
    });

    it('anonymous actor on a scoped model returns ZERO rows (deny default)', async () => {
      const bays = await scoped.bay.findMany(); // no RequestContext.run → anonymous
      expect(bays).toHaveLength(0);
    });

    it('super-admin actor sees ALL rows across tenants', async () => {
      const bays = await RequestContext.run(actorSuperAdmin, () => scoped.bay.findMany());
      expect(bays.length).toBe(4); // 2 from A + 2 from B
      const tenantIds = new Set(bays.map((b) => b.tenantId));
      expect(tenantIds).toEqual(new Set([fx.tenantA.tenantId, fx.tenantB.tenantId]));
    });

    it('tenant actor querying customer-scoped model is DENIED', async () => {
      // Favorite is customer-scoped. A tenant trying to read favorites
      // should get nothing — the extension injects the deny filter.
      const favs = await RequestContext.run(actorA, () => scoped.favorite.findMany());
      expect(favs).toHaveLength(0);
    });

    it('customer actor sees ONLY own transactions', async () => {
      // Aysel has no transactions; elvin has one (at tenant A's bay).
      const elvinTx = await RequestContext.run(actorElvin, () => scoped.transaction.findMany());
      expect(elvinTx).toHaveLength(1);
      expect(elvinTx[0]?.customerId).toBe(fx.customers.elvinId);

      const ayselTx = await RequestContext.run(
        { type: 'customer', id: fx.customers.ayselId, phone: '+994500000004' },
        () => scoped.transaction.findMany(),
      );
      expect(ayselTx).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // findFirst — the SAFE alternative to findUnique on scoped models
  // ──────────────────────────────────────────────────────────────

  describe('findFirst — also scoped, safe across tenants', () => {
    it('tenant A actor findFirst by tenant B bay id returns null', async () => {
      // Ask for tenant B's bay BY ID — extension wraps with AND to add
      // tenantId=A constraint. No row matches → null.
      const result = await RequestContext.run(actorA, () =>
        scoped.bay.findFirst({ where: { id: fx.tenantB.bayIds[0] } }),
      );
      expect(result).toBeNull();
    });

    it('tenant A actor findFirst by own bay id returns the bay', async () => {
      const result = await RequestContext.run(actorA, () =>
        scoped.bay.findFirst({ where: { id: fx.tenantA.bayIds[0] } }),
      );
      expect(result).not.toBeNull();
      expect(result!.tenantId).toBe(fx.tenantA.tenantId);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // findUnique / findUniqueOrThrow — Group B (pre-check pattern)
  // ──────────────────────────────────────────────────────────────

  describe('findUnique — pre-check enforces scope', () => {
    it('findUnique on OWN row returns the row', async () => {
      const result = await RequestContext.run(actorA, () =>
        scoped.bay.findUnique({ where: { id: fx.tenantA.bayIds[0] } }),
      );
      expect(result).not.toBeNull();
      expect(result!.tenantId).toBe(fx.tenantA.tenantId);
    });

    it('findUnique on CROSS-TENANT row returns null (pre-check filters it out)', async () => {
      // Tenant A tries to fetch tenant B's bay by id.
      // The extension's pre-check (via findFirst with AND-wrapped where)
      // confirms no such row in tenant A's scope → returns null.
      const result = await RequestContext.run(actorA, () =>
        scoped.bay.findUnique({ where: { id: fx.tenantB.bayIds[0] } }),
      );
      expect(result).toBeNull();
    });

    it('findUnique runs without PrismaClientValidationError', async () => {
      // Reproduces the original 500. If the extension regresses to
      // AND-wrapping WhereUniqueInput, Prisma rejects with that error.
      // Should resolve cleanly.
      await expect(
        RequestContext.run(actorA, () =>
          scoped.tenant.findUnique({ where: { id: fx.tenantA.tenantId } }),
        ),
      ).resolves.not.toBeNull();
    });

    it('findUniqueOrThrow on cross-tenant row throws P2025', async () => {
      await expect(
        RequestContext.run(actorA, () =>
          scoped.bay.findUniqueOrThrow({ where: { id: fx.tenantB.bayIds[0] } }),
        ),
      ).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // update / delete — Group B (pre-check + proceed)
  // ──────────────────────────────────────────────────────────────

  describe('update / delete — Group B (pre-check)', () => {
    it('update on OWN bay succeeds and returns the updated row', async () => {
      const result = await RequestContext.run(actorA, () =>
        scoped.bay.update({
          where: { id: fx.tenantA.bayIds[1] },
          data: { name: 'A Bay 2 — renamed' },
        }),
      );
      expect(result.id).toBe(fx.tenantA.bayIds[1]);
      expect(result.name).toBe('A Bay 2 — renamed');
    });

    it('update on CROSS-TENANT bay throws P2025 (extension blocks before DB write)', async () => {
      // Try to disable tenant B's bay from tenant A's session.
      await expect(
        RequestContext.run(actorA, () =>
          scoped.bay.update({
            where: { id: fx.tenantB.bayIds[0] },
            data: { status: 'disabled' },
          }),
        ),
      ).rejects.toMatchObject({ code: 'P2025' });

      // Verify tenant B's bay is untouched.
      const bBay = await raw.bay.findUnique({ where: { id: fx.tenantB.bayIds[0] } });
      expect(bBay!.status).toBe('active');
    });

    it('update runs without PrismaClientValidationError (regression test)', async () => {
      // Reproduces the second 500. If the extension regresses to
      // AND-wrapping update's WhereUniqueInput, Prisma errors with
      // "Argument `where` of type BayWhereUniqueInput needs at least one
      // of `id`, `hardwareIdentifier` or `qrShortId` arguments." Should
      // resolve cleanly.
      await expect(
        RequestContext.run(actorA, () =>
          scoped.bay.update({
            where: { id: fx.tenantA.bayIds[0] },
            data: { name: 'A Bay 1' },
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('delete on CROSS-TENANT row throws P2025', async () => {
      await expect(
        RequestContext.run(actorA, () =>
          scoped.bay.delete({ where: { id: fx.tenantB.bayIds[1] } }),
        ),
      ).rejects.toMatchObject({ code: 'P2025' });

      // Verify tenant B's bay still exists.
      const bBay = await raw.bay.findUnique({ where: { id: fx.tenantB.bayIds[1] } });
      expect(bBay).not.toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // withBypass — escape hatch
  // ──────────────────────────────────────────────────────────────

  describe('RequestContext.withBypass', () => {
    it('disables scoping inside the wrapped callback', async () => {
      const bays = await RequestContext.run(actorA, () =>
        RequestContext.withBypass(() => scoped.bay.findMany()),
      );
      expect(bays.length).toBe(4);
      const tenantIds = new Set(bays.map((b) => b.tenantId));
      expect(tenantIds).toEqual(new Set([fx.tenantA.tenantId, fx.tenantB.tenantId]));
    });

    it('bypass scope is restored after the callback', async () => {
      // First call bypasses; second call (outside withBypass) re-enables.
      await RequestContext.run(actorA, async () => {
        await RequestContext.withBypass(() => scoped.bay.findMany());
        const baysScoped = await scoped.bay.findMany();
        expect(baysScoped.length).toBe(2); // back to tenant-A only
        expect(baysScoped.every((b) => b.tenantId === fx.tenantA.tenantId)).toBe(true);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Writes — scoping applies on update/delete too
  // ──────────────────────────────────────────────────────────────

  describe('updateMany / deleteMany — write-side scoping', () => {
    it('tenant A cannot updateMany tenant B bays', async () => {
      // Try to disable ALL bays from tenant A's session.
      const result = await RequestContext.run(actorA, () =>
        scoped.bay.updateMany({
          where: { tenantId: fx.tenantB.tenantId },
          data: { status: 'disabled' },
        }),
      );
      // Result: zero rows affected (scope filter wrapped with AND keeps it to A's tenant).
      expect(result.count).toBe(0);

      // Verify tenant B's bays are untouched.
      const bBays = await RequestContext.run(actorSuperAdmin, () =>
        scoped.bay.findMany({ where: { tenantId: fx.tenantB.tenantId } }),
      );
      expect(bBays.every((b) => b.status === 'active')).toBe(true);
    });
  });
});
