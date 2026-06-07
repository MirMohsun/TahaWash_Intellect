import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { AppRoot } from '@/components/layout/app-root';
import { AppShell } from '@/components/layout/app-shell';
import { SuperAdminAppShell } from '@/components/layout/super-admin-app-shell';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { LoginPage } from '@/features/auth/login-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { AccountSettingsPage } from '@/features/account/account-settings-page';
import { BrandingPage } from '@/features/branding/branding-page';
import { BusinessProfilePage } from '@/features/business-profile/business-profile-page';
import { FinancialsPage } from '@/features/financials/financials-page';
import { LocationFormPage } from '@/features/locations/location-form-page';
import { LocationsPage } from '@/features/locations/locations-page';
import { SubscriptionPage } from '@/features/subscription/subscription-page';
import { TransactionDetailPage } from '@/features/transactions/transaction-detail-page';
import { TransactionsPage } from '@/features/transactions/transactions-page';
import { SuperAdminLoginPage } from '@/features/super-admin/auth/super-admin-login-page';
import { SuperAdminDashboardPage } from '@/features/super-admin/dashboard/super-admin-dashboard-page';
import { SuperAdminTenantsListPage } from '@/features/super-admin/tenants/tenants-list-page';
import { SuperAdminTenantFormPage } from '@/features/super-admin/tenants/tenant-form-page';
import { SuperAdminTenantDetailPage } from '@/features/super-admin/tenants/tenant-detail-page';
import { SuperAdminSubscriptionsListPage } from '@/features/super-admin/subscriptions/subscriptions-list-page';
import { SuperAdminSubscriptionFormPage } from '@/features/super-admin/subscriptions/subscription-form-page';
import { SuperAdminAnalyticsPage } from '@/features/super-admin/analytics/analytics-page';
import { SuperAdminPushComposerPage } from '@/features/super-admin/push/push-composer-page';
import { SuperAdminPushDetailPage } from '@/features/super-admin/push/push-detail-page';
import { SuperAdminPushHistoryPage } from '@/features/super-admin/push/push-history-page';
import { SuperAdminPromoFormPage } from '@/features/super-admin/promos/promo-form-page';
import { SuperAdminPromosListPage } from '@/features/super-admin/promos/promos-list-page';
import { SuperAdminFeaturedManagerPage } from '@/features/super-admin/featured/featured-manager-page';
import { SuperAdminSettingsPage } from '@/features/super-admin/settings/settings-page';
import { SuperAdminVersionPage } from '@/features/super-admin/version/version-page';
import { SuperAdminLegalPage } from '@/features/super-admin/legal/legal-page';
import { SuperAdminAuditLogsPage } from '@/features/super-admin/audit/audit-logs-page';

/**
 * Tahawash admin router.
 *
 * Shape:
 *   /                  → AppRoot (boots auth, paints tenant theme, renders Outlet)
 *     /login           → LoginPage (bounces to /dashboard if authed)
 *     /protected       → AppShell (protected layout, bounces to /login if unauth)
 *       /dashboard     → DashboardPage
 *     /                → redirect → /dashboard
 *
 * Auth-gating: there is no router-level guard yet — the AppShell component
 * itself bounces to /login when it sees status === 'unauth' and LoginPage
 * bounces to /dashboard when status === 'authed'. AppRoot also renders a
 * spinner while status === 'unknown' so we never paint the wrong tree.
 *
 * The index route redirects to /dashboard so visiting `/` lands somewhere
 * meaningful (auth state then routes the user accordingly).
 */
const rootRoute = createRootRoute({
  component: AppRoot,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): { reset?: 'ok' } => ({
    reset: search.reset === 'ok' ? 'ok' : undefined,
  }),
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
});

const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const locationsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/locations',
  component: LocationsPage,
});

const locationNewRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/locations/new',
  component: () => <LocationFormPage mode="create" />,
});

const locationDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/locations/$locationId',
  component: () => <LocationFormPage mode="edit" />,
});

const transactionsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/transactions',
  component: TransactionsPage,
});

const transactionDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/transactions/$transactionId',
  component: TransactionDetailPage,
});

const financialsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/financials',
  component: FinancialsPage,
});

const brandingRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/branding',
  component: BrandingPage,
});

const businessProfileRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/business-profile',
  component: BusinessProfilePage,
});

const subscriptionRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/subscription',
  component: SubscriptionPage,
});

const accountRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/account',
  component: AccountSettingsPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
});

// ─── Super-admin routes ──────────────────────────────────────────────
// Lives alongside tenant routes in the same Vite app; uses its own auth
// store (`useSuperAdminAuthStore`) + its own axios singleton + its own
// localStorage namespace (`tahawash.super.*`). Tenant + super-admin
// sessions can coexist in the same browser.

const superAdminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/super-admin/login',
  component: SuperAdminLoginPage,
});

const superAdminProtectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'super-admin-protected',
  component: SuperAdminAppShell,
});

const superAdminDashboardRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/dashboard',
  component: SuperAdminDashboardPage,
});

const superAdminTenantsRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/tenants',
  component: SuperAdminTenantsListPage,
});

const superAdminTenantNewRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/tenants/new',
  component: SuperAdminTenantFormPage,
});

const superAdminTenantDetailRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/tenants/$tenantId',
  component: SuperAdminTenantDetailPage,
});

const superAdminSubscriptionsRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/subscriptions',
  component: SuperAdminSubscriptionsListPage,
  validateSearch: (search: Record<string, unknown>): { tenantId?: string } => ({
    tenantId: typeof search.tenantId === 'string' ? search.tenantId : undefined,
  }),
});

const superAdminSubscriptionNewRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/subscriptions/new',
  component: SuperAdminSubscriptionFormPage,
  validateSearch: (search: Record<string, unknown>): { tenantId?: string } => ({
    tenantId: typeof search.tenantId === 'string' ? search.tenantId : undefined,
  }),
});

const superAdminAnalyticsRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/analytics',
  component: SuperAdminAnalyticsPage,
});

const superAdminPushHistoryRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/push',
  component: SuperAdminPushHistoryPage,
});

const superAdminPushNewRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/push/new',
  component: SuperAdminPushComposerPage,
});

const superAdminPushDetailRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/push/$pushId',
  component: SuperAdminPushDetailPage,
});

const superAdminPromosRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/promos',
  component: SuperAdminPromosListPage,
});

const superAdminPromoNewRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/promos/new',
  component: () => <SuperAdminPromoFormPage mode="create" />,
});

const superAdminPromoDetailRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/promos/$promoId',
  component: () => <SuperAdminPromoFormPage mode="edit" />,
});

const superAdminFeaturedRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/featured',
  component: SuperAdminFeaturedManagerPage,
});

const superAdminSettingsRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/settings',
  component: SuperAdminSettingsPage,
});

const superAdminVersionRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/version',
  component: SuperAdminVersionPage,
});

const superAdminLegalRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/legal',
  component: SuperAdminLegalPage,
});

const superAdminAuditRoute = createRoute({
  getParentRoute: () => superAdminProtectedLayoutRoute,
  path: '/super-admin/audit',
  component: SuperAdminAuditLogsPage,
});

const superAdminIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/super-admin',
  beforeLoad: () => {
    throw redirect({ to: '/super-admin/dashboard' });
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  superAdminLoginRoute,
  superAdminIndexRoute,
  protectedLayoutRoute.addChildren([
    dashboardRoute,
    locationsRoute,
    locationNewRoute,
    locationDetailRoute,
    transactionsRoute,
    transactionDetailRoute,
    financialsRoute,
    brandingRoute,
    businessProfileRoute,
    subscriptionRoute,
    accountRoute,
  ]),
  superAdminProtectedLayoutRoute.addChildren([
    superAdminDashboardRoute,
    superAdminTenantsRoute,
    superAdminTenantNewRoute,
    superAdminTenantDetailRoute,
    superAdminSubscriptionsRoute,
    superAdminSubscriptionNewRoute,
    superAdminAnalyticsRoute,
    superAdminPushHistoryRoute,
    superAdminPushNewRoute,
    superAdminPushDetailRoute,
    superAdminPromosRoute,
    superAdminPromoNewRoute,
    superAdminPromoDetailRoute,
    superAdminFeaturedRoute,
    superAdminSettingsRoute,
    superAdminVersionRoute,
    superAdminLegalRoute,
    superAdminAuditRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
