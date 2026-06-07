import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Minimal but realistic fixture shape: two tenants (A and B), each with
 * one tenant user, one location, two bays, plus two customers and one
 * paid transaction at tenant A's bay.
 *
 * Returned ids let tests assert cross-tenant isolation precisely:
 *   "tenant A actor querying bays must NOT see fixture.tenantB.bayIds"
 */
export interface ScopingFixture {
  superAdmin: { id: string; username: string };
  tenantA: {
    tenantId: string;
    userId: string;
    locationId: string;
    bayIds: [string, string];
  };
  tenantB: {
    tenantId: string;
    userId: string;
    locationId: string;
    bayIds: [string, string];
  };
  customers: {
    elvinId: string;
    ayselId: string;
  };
  /** One paid transaction at tenantA.bayIds[0] by customers.elvinId. */
  transactionId: string;
}

export async function seedScopingFixture(prisma: PrismaClient): Promise<ScopingFixture> {
  const pwHash = await bcrypt.hash('test-password-only', 10);

  const superAdmin = await prisma.superAdminUser.create({
    data: {
      username: 'test-admin',
      email: 'test-admin@tahawash.test',
      passwordHash: pwHash,
      fullName: 'Test Admin',
    },
  });

  // ── Tenant A ──────────────────────────────────────────────────
  const tenantA = await prisma.tenant.create({
    data: {
      brandName: 'TenantA Wash',
      legalName: 'TenantA LLC',
      voen: '1111111111',
      ownerName: 'Owner A',
      ownerEmail: 'a@test.test',
      ownerPhone: '+994500000001',
      themeColor: '#0E7AE7',
      status: 'active',
    },
  });
  const userA = await prisma.tenantUser.create({
    data: { tenantId: tenantA.id, username: 'tenanta', passwordHash: pwHash },
  });
  const locA = await prisma.location.create({
    data: {
      tenantId: tenantA.id,
      name: 'A Loc',
      address: 'A address',
      latitude: 40.4,
      longitude: 49.85,
      is24_7: true,
      status: 'active',
    },
  });
  const bayA1 = await prisma.bay.create({
    data: {
      tenantId: tenantA.id,
      locationId: locA.id,
      name: 'A Bay 1',
      qrShortId: 'AAAA01',
      status: 'active',
    },
  });
  const bayA2 = await prisma.bay.create({
    data: {
      tenantId: tenantA.id,
      locationId: locA.id,
      name: 'A Bay 2',
      qrShortId: 'AAAA02',
      status: 'active',
    },
  });

  // ── Tenant B ──────────────────────────────────────────────────
  const tenantB = await prisma.tenant.create({
    data: {
      brandName: 'TenantB Wash',
      legalName: 'TenantB LLC',
      voen: '2222222222',
      ownerName: 'Owner B',
      ownerEmail: 'b@test.test',
      ownerPhone: '+994500000002',
      themeColor: '#FF6E54',
      status: 'active',
    },
  });
  const userB = await prisma.tenantUser.create({
    data: { tenantId: tenantB.id, username: 'tenantb', passwordHash: pwHash },
  });
  const locB = await prisma.location.create({
    data: {
      tenantId: tenantB.id,
      name: 'B Loc',
      address: 'B address',
      latitude: 40.4,
      longitude: 49.86,
      is24_7: true,
      status: 'active',
    },
  });
  const bayB1 = await prisma.bay.create({
    data: {
      tenantId: tenantB.id,
      locationId: locB.id,
      name: 'B Bay 1',
      qrShortId: 'BBBB01',
      status: 'active',
    },
  });
  const bayB2 = await prisma.bay.create({
    data: {
      tenantId: tenantB.id,
      locationId: locB.id,
      name: 'B Bay 2',
      qrShortId: 'BBBB02',
      status: 'active',
    },
  });

  // ── Customers (cross-tenant — not scoped to either) ──────────
  const elvin = await prisma.customer.create({
    data: { phone: '+994500000003', name: 'Elvin Test', language: 'az' },
  });
  const aysel = await prisma.customer.create({
    data: { phone: '+994500000004', name: 'Aysel Test', language: 'ru' },
  });

  // ── One transaction (elvin paid at tenant A's bay) ───────────
  const tx = await prisma.transaction.create({
    data: {
      customerId: elvin.id,
      bayId: bayA1.id,
      locationId: locA.id,
      tenantId: tenantA.id,
      amountAzn: '2.50',
      status: 'paid_credited',
      paymentMethod: 'card',
      ePointReference: 'test_ref_001',
    },
  });

  return {
    superAdmin: { id: superAdmin.id, username: superAdmin.username },
    tenantA: {
      tenantId: tenantA.id,
      userId: userA.id,
      locationId: locA.id,
      bayIds: [bayA1.id, bayA2.id],
    },
    tenantB: {
      tenantId: tenantB.id,
      userId: userB.id,
      locationId: locB.id,
      bayIds: [bayB1.id, bayB2.id],
    },
    customers: { elvinId: elvin.id, ayselId: aysel.id },
    transactionId: tx.id,
  };
}
