import { Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { useSuperAdminAuthStore } from '../../store/super-admin-auth';
import { TenantThemeProvider } from '../system/tenant-theme';

/**
 * Top-level layout. Runs once on app boot:
 *   1. hydrate BOTH auth stores (tenant + super-admin) in parallel — each
 *      reads its own localStorage namespace and optionally pulls /me. They
 *      are independent: signing into one doesn't affect the other.
 *   2. wrap everything in TenantThemeProvider so the active tenant's brand
 *      color flows down once 'authed' (super-admin routes naturally fall
 *      back to Tahawash defaults — no tenant snapshot → defaults stay).
 *
 * Renders a centered spinner while EITHER store is still 'unknown' so we
 * don't briefly paint a login page before redirecting an already-authed
 * user (or vice versa).
 */
export function AppRoot() {
  const tenantStatus = useAuthStore((s) => s.status);
  const tenantHydrate = useAuthStore((s) => s.hydrate);
  const superStatus = useSuperAdminAuthStore((s) => s.status);
  const superHydrate = useSuperAdminAuthStore((s) => s.hydrate);

  useEffect(() => {
    void tenantHydrate();
    void superHydrate();
  }, [tenantHydrate, superHydrate]);

  if (tenantStatus === 'unknown' || superStatus === 'unknown') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <TenantThemeProvider>
      <Outlet />
    </TenantThemeProvider>
  );
}
