import type { Actor } from '../../common/actor.types';
import { buildScopeFilter } from './tenant-scoping.logic';

describe('buildScopeFilter', () => {
  // ─── Actor fixtures ──────────────────────────────────────────
  const superAdmin: Actor = { type: 'super_admin', id: 'sa-1', username: 'admin' };
  const tenantA: Actor = {
    type: 'tenant',
    id: 'tu-a',
    tenantId: 'tenant-a',
    username: 'yubox',
  };
  const tenantB: Actor = {
    type: 'tenant',
    id: 'tu-b',
    tenantId: 'tenant-b',
    username: 'shinywash',
  };
  const customer: Actor = {
    type: 'customer',
    id: 'cust-1',
    phone: '+994501234567',
  };
  const anonymous: Actor = { type: 'anonymous' };

  // ─── Super-admin ─────────────────────────────────────────────
  describe('super_admin', () => {
    it('applies no scoping to tenant-scoped models', () => {
      expect(buildScopeFilter('Location', superAdmin)).toBeNull();
      expect(buildScopeFilter('Bay', superAdmin)).toBeNull();
      expect(buildScopeFilter('Tenant', superAdmin)).toBeNull();
    });
    it('applies no scoping to customer-scoped models', () => {
      expect(buildScopeFilter('SavedCard', superAdmin)).toBeNull();
      expect(buildScopeFilter('Favorite', superAdmin)).toBeNull();
    });
  });

  // ─── Tenant actor ────────────────────────────────────────────
  describe('tenant actor', () => {
    it('scopes tenant-scoped models by tenantId', () => {
      expect(buildScopeFilter('Location', tenantA)).toEqual({ tenantId: 'tenant-a' });
      expect(buildScopeFilter('Bay', tenantA)).toEqual({ tenantId: 'tenant-a' });
      expect(buildScopeFilter('Subscription', tenantA)).toEqual({ tenantId: 'tenant-a' });
      expect(buildScopeFilter('Transaction', tenantA)).toEqual({ tenantId: 'tenant-a' });
    });

    it('scopes the Tenant table itself by id', () => {
      expect(buildScopeFilter('Tenant', tenantA)).toEqual({ id: 'tenant-a' });
    });

    it('scopes TenantRefreshToken via the user relation', () => {
      expect(buildScopeFilter('TenantRefreshToken', tenantA)).toEqual({
        user: { is: { tenantId: 'tenant-a' } },
      });
    });

    it('different tenants get different scopes (isolation)', () => {
      const a = buildScopeFilter('Location', tenantA);
      const b = buildScopeFilter('Location', tenantB);
      expect(a).not.toEqual(b);
      expect(a).toEqual({ tenantId: 'tenant-a' });
      expect(b).toEqual({ tenantId: 'tenant-b' });
    });

    it('denies access to customer-scoped models', () => {
      expect(buildScopeFilter('SavedCard', tenantA)).toEqual({ id: '__deny__' });
      expect(buildScopeFilter('Favorite', tenantA)).toEqual({ id: '__deny__' });
      expect(buildScopeFilter('CustomerRefreshToken', tenantA)).toEqual({
        id: '__deny__',
      });
    });

    it('does not scope unrelated models (e.g. OtpCode)', () => {
      expect(buildScopeFilter('OtpCode', tenantA)).toBeNull();
    });
  });

  // ─── Customer actor ──────────────────────────────────────────
  describe('customer actor', () => {
    it('scopes customer-scoped models by customerId', () => {
      expect(buildScopeFilter('SavedCard', customer)).toEqual({ customerId: 'cust-1' });
      expect(buildScopeFilter('Favorite', customer)).toEqual({ customerId: 'cust-1' });
      expect(buildScopeFilter('Transaction', customer)).toEqual({ customerId: 'cust-1' });
    });

    it('denies access to tenant-scoped models (except Tenant itself which is public-readable via bypass)', () => {
      expect(buildScopeFilter('Location', customer)).toEqual({ id: '__deny__' });
      expect(buildScopeFilter('Bay', customer)).toEqual({ id: '__deny__' });
      expect(buildScopeFilter('Subscription', customer)).toEqual({ id: '__deny__' });
      // Tenant itself returns null so customer endpoints can still serve
      // the public tenant brand page via the regular scoped client.
      expect(buildScopeFilter('Tenant', customer)).toBeNull();
    });
  });

  // ─── Anonymous actor ─────────────────────────────────────────
  describe('anonymous actor', () => {
    it('denies access to all protected models', () => {
      expect(buildScopeFilter('Location', anonymous)).toEqual({ id: '__deny__' });
      expect(buildScopeFilter('SavedCard', anonymous)).toEqual({ id: '__deny__' });
      expect(buildScopeFilter('Transaction', anonymous)).toEqual({ id: '__deny__' });
    });

    it('does not interfere with non-protected models', () => {
      expect(buildScopeFilter('OtpCode', anonymous)).toBeNull();
      expect(buildScopeFilter('AppVersion', anonymous)).toBeNull();
    });
  });
});
