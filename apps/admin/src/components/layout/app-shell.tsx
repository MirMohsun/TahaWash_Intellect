import { Outlet, useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import { LogoLockup } from '../brand/logo';
import { NotificationBell } from '../system/notification-bell';
import { Sidebar } from './sidebar';

/**
 * Authenticated app shell — sidebar + top bar + content area.
 *
 * Phase 3.5 added the left sidebar (Dashboard + Locations links). Future
 * stages add nav rows as their features ship; never link a dead route.
 *
 * Redirects to /login if the user isn't authed (defensive — the router
 * should never land here without auth, but if the auth state changes
 * after mount we want a hard kick).
 */
export function AppShell() {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const tenant = useAuthStore((s) => s.tenant);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'unauth') {
      void navigate({ to: '/login' });
    }
  }, [status, navigate]);

  if (status !== 'authed' || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar */}
      <header className="bg-bg-elev border-b border-line px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <LogoLockup size={28} />
          <span className="text-ink-300">·</span>
          <span className="text-sm font-semibold text-ink-700">{tenant.brandName}</span>
          {tenant.status === 'suspended' && (
            <span className="ml-2 px-2 py-0.5 rounded-pill bg-amber-50 text-amber text-xs font-semibold">
              {t('tenantAdmin.status.suspended')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors px-2 py-1 rounded-card-sm hover:bg-line-soft"
          >
            <LogOut className="h-4 w-4" />
            {t('tenantAdmin.shell.logout')}
          </button>
        </div>
      </header>

      {/* Sidebar + content */}
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
