import { Link, useLocation } from '@tanstack/react-router';
import {
  Building2,
  CalendarClock,
  Coins,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Palette,
  ReceiptText,
  Settings,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Tenant-admin left sidebar.
 *
 * Only the routes we have built today are linked — no dead links. New
 * entries appear as their stages ship (Bays in 3.8, Transactions in 3.12,
 * Branding in 3.15, Subscription in 3.18, etc.).
 *
 * Active state matches by route path prefix so nested routes still
 * highlight their parent tab (e.g. /locations/new keeps "Locations" lit).
 */
interface NavItem {
  to: string;
  match: string;
  labelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const NAV: NavItem[] = [
  {
    to: '/dashboard',
    match: '/dashboard',
    labelKey: 'tenantAdmin.nav.dashboard',
    icon: LayoutDashboard,
  },
  { to: '/locations', match: '/locations', labelKey: 'tenantAdmin.nav.locations', icon: MapPin },
  {
    to: '/transactions',
    match: '/transactions',
    labelKey: 'tenantAdmin.nav.transactions',
    icon: ReceiptText,
  },
  {
    to: '/financials',
    match: '/financials',
    labelKey: 'tenantAdmin.nav.financials',
    icon: Coins,
  },
  {
    to: '/branding',
    match: '/branding',
    labelKey: 'tenantAdmin.nav.branding',
    icon: Palette,
  },
  {
    to: '/business-profile',
    match: '/business-profile',
    labelKey: 'tenantAdmin.nav.businessProfile',
    icon: Building2,
  },
  {
    to: '/subscription',
    match: '/subscription',
    labelKey: 'tenantAdmin.nav.subscription',
    icon: CalendarClock,
  },
  {
    to: '/payments',
    match: '/payments',
    labelKey: 'tenantAdmin.nav.payments',
    icon: CreditCard,
  },
  {
    to: '/account',
    match: '/account',
    labelKey: 'tenantAdmin.nav.account',
    icon: Settings,
  },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <nav className="w-60 shrink-0 bg-bg-elev border-r border-line py-6 hidden md:flex md:flex-col">
      <div className="px-4 mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
        {t('tenantAdmin.nav.sectionMain')}
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
