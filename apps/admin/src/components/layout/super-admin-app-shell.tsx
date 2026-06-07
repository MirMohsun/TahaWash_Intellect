import { Outlet, useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuperAdminAuthStore } from '../../store/super-admin-auth';
import { LogoLockup } from '../brand/logo';
import { SuperAdminSidebar } from './super-admin-sidebar';

/**
 * Authenticated super-admin shell — sidebar + top bar + content area.
 *
 * Parallel to tenant `AppShell`. Differences:
 *  - Brand strip carries the "Super-admin" badge (no per-tenant brand)
 *  - Reads from `useSuperAdminAuthStore`, not the tenant store
 *  - Sidebar items live in `SuperAdminSidebar` (a separate list — different
 *    routes, different domain)
 *
 * Redirects to /super-admin/login if not authed (defensive — the router
 * should never land here unauthenticated, but we guard against post-mount
 * status flips).
 */
export function SuperAdminAppShell() {
  const { t } = useTranslation();
  const status = useSuperAdminAuthStore((s) => s.status);
  const principal = useSuperAdminAuthStore((s) => s.principal);
  const logout = useSuperAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'unauth') {
      void navigate({ to: '/super-admin/login' });
    }
  }, [status, navigate]);

  if (status !== 'authed' || !principal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="bg-bg-elev border-b border-line px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <LogoLockup size={28} />
          <span className="text-ink-300">·</span>
          <span className="px-2 py-0.5 rounded-pill bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider">
            {t('superAdmin.shell.badge')}
          </span>
          <span className="text-sm font-medium text-ink-500">{principal.username}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors px-2 py-1 rounded-card-sm hover:bg-line-soft"
          >
            <LogOut className="h-4 w-4" />
            {t('superAdmin.shell.logout')}
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        <SuperAdminSidebar />
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
