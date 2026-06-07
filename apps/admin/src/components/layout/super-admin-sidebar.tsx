import { Link, useLocation } from '@tanstack/react-router';
import {
  Bell,
  Building2,
  CalendarClock,
  FileText,
  History,
  LayoutDashboard,
  Megaphone,
  Settings,
  Smartphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Super-admin left sidebar.
 *
 * Parallel to tenant `sidebar.tsx`. Lists ONLY the super-admin routes we
 * have shipped so far — no dead links. As Phase 4 stages land (Tenants
 * C3.1, Push C7.1, Promos C8.1, Featured C9.1, Settings C10.*, Audit log)
 * new rows are added.
 *
 * Phase 4.1 ships with just Dashboard (placeholder content; the real C2.1
 * platform dashboard lands as the next stage).
 */
interface NavItem {
  to: string;
  match: string;
  labelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const NAV: NavItem[] = [
  {
    to: '/super-admin/dashboard',
    match: '/super-admin/dashboard',
    labelKey: 'superAdmin.nav.dashboard',
    icon: LayoutDashboard,
  },
  {
    to: '/super-admin/tenants',
    match: '/super-admin/tenants',
    labelKey: 'superAdmin.nav.tenants',
    icon: Building2,
  },
  {
    to: '/super-admin/subscriptions',
    match: '/super-admin/subscriptions',
    labelKey: 'superAdmin.nav.subscriptions',
    icon: CalendarClock,
  },
  {
    to: '/super-admin/analytics',
    match: '/super-admin/analytics',
    labelKey: 'superAdmin.nav.analytics',
    icon: TrendingUp,
  },
  {
    to: '/super-admin/push',
    match: '/super-admin/push',
    labelKey: 'superAdmin.nav.push',
    icon: Bell,
  },
  {
    to: '/super-admin/promos',
    match: '/super-admin/promos',
    labelKey: 'superAdmin.nav.promos',
    icon: Megaphone,
  },
  {
    to: '/super-admin/featured',
    match: '/super-admin/featured',
    labelKey: 'superAdmin.nav.featured',
    icon: Sparkles,
  },
  {
    to: '/super-admin/settings',
    match: '/super-admin/settings',
    labelKey: 'superAdmin.nav.settings',
    icon: Settings,
  },
  {
    to: '/super-admin/version',
    match: '/super-admin/version',
    labelKey: 'superAdmin.nav.version',
    icon: Smartphone,
  },
  {
    to: '/super-admin/legal',
    match: '/super-admin/legal',
    labelKey: 'superAdmin.nav.legal',
    icon: FileText,
  },
  {
    to: '/super-admin/audit',
    match: '/super-admin/audit',
    labelKey: 'superAdmin.nav.audit',
    icon: History,
  },
];

export function SuperAdminSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <nav className="w-60 shrink-0 bg-bg-elev border-r border-line py-6 hidden md:flex md:flex-col">
      <div className="px-4 mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
        {t('superAdmin.nav.sectionMain')}
      </div>
      <ul className="px-2 space-y-1">
        {NAV.map((item) => {
          const isActive = pathname.startsWith(item.match);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center gap-2.5 rounded-card-sm px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-ink-700 hover:bg-line-soft hover:text-ink-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-brand-600' : 'text-ink-400'}`} />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
