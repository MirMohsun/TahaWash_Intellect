/**
 * Super-admin API singleton + typed wrappers.
 *
 * Parallel to `api.ts` + `tenant-api.ts`. Separate axios instance so the
 * 401-refresh interceptor hits `/auth/super-admin/refresh` (not the tenant
 * endpoint) and so the X-Admin-Surface header tells the backend which
 * surface generated the request.
 *
 * Endpoint surface (all already shipped in Phase 1.4a):
 *   POST   /auth/super-admin/login    — username + password → tokens + userId
 *   POST   /auth/super-admin/refresh  — refresh rotation (called via interceptor)
 *   POST   /auth/super-admin/logout   — revoke refresh
 *   GET    /auth/super-admin/me       — current principal (smoke + hydrate)
 */
import { createApiClient } from '@tahawash/api-client';
import { superAdminTokenStore } from './super-admin-token-store';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let superAdminAuthFailureHandler: (() => void) | null = null;
export function setSuperAdminAuthFailureHandler(handler: () => void): void {
  superAdminAuthFailureHandler = handler;
}

export const superAdminApi = createApiClient({
  baseURL,
  tokenStore: superAdminTokenStore,
  refreshPath: '/auth/super-admin/refresh',
  onAuthFailure: () => {
    superAdminAuthFailureHandler?.();
  },
  defaultHeaders: {
    'X-Admin-Surface': 'super-admin',
  },
});

export interface SuperAdminLoginResponse {
  userId: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
  };
}

/** Shape returned by GET /auth/super-admin/me — matches `SuperAdminPrincipal`. */
export interface SuperAdminMe {
  type: 'super_admin';
  id: string;
  username: string;
}

export async function superAdminLogin(
  username: string,
  password: string,
): Promise<SuperAdminLoginResponse> {
  const { data } = await superAdminApi.post<SuperAdminLoginResponse>('/auth/super-admin/login', {
    username,
    password,
  });
  return data;
}

export async function superAdminLogout(refreshToken: string): Promise<void> {
  await superAdminApi.post('/auth/super-admin/logout', { refreshToken });
}

export async function fetchSuperAdminMe(): Promise<SuperAdminMe> {
  const { data } = await superAdminApi.get<SuperAdminMe>('/auth/super-admin/me');
  return data;
}

// ─── Platform dashboard (C2.1) ─────────────────────────────────────

export type TenantStatusKey = 'pending' | 'active' | 'suspended' | 'hidden';

export interface SuperAdminDashboardResponse {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
    hidden: number;
  };
  totalDevices: number;
  txToday: {
    paidAmountAzn: string;
    txCount: number;
  };
  txMonth: {
    paidAmountAzn: string;
    txCount: number;
  };
  mrr: {
    amountAzn: string;
    subscriptionCount: number;
  };
  tenantGrowth6mo: Array<{ month: string; count: number }>;
  subscriptionWatchlist: Array<{
    tenantId: string;
    brandName: string;
    status: TenantStatusKey;
    subscriptionEnd: string;
    daysLeft: number;
  }>;
  recentActivity: Array<{
    id: string;
    actorType: string;
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    createdAt: string;
  }>;
}

export async function fetchSuperAdminDashboard(): Promise<SuperAdminDashboardResponse> {
  const { data } = await superAdminApi.get<SuperAdminDashboardResponse>('/super-admin/dashboard');
  return data;
}

// ─── Tenants list (C3.1) ───────────────────────────────────────────

export type TenantListStatusKey = 'pending' | 'active' | 'suspended' | 'hidden' | 'expired';

export type TenantListSortKey =
  | 'createdAt:desc'
  | 'createdAt:asc'
  | 'brandName:asc'
  | 'brandName:desc'
  | 'subscriptionEnd:asc'
  | 'subscriptionEnd:desc';

export interface SuperAdminTenantListItem {
  id: string;
  brandName: string;
  legalName: string;
  voen: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ePointMerchantId: string | null;
  themeColor: string;
  logoUrl: string | null;
  contactPhone: string | null;
  minChargeAmount: string;
  chargeStep: string;
  status: TenantStatusKey;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  createdAt: string;
  updatedAt: string;
  /** Live customer-facing bays (status=active under active+visible location). */
  devicesCount: number;
  /** Paid amount (paid_credited + paid_hardware_error) for current Baku month. */
  monthRevenueAzn: string;
}

export interface SuperAdminTenantsListResponse {
  items: SuperAdminTenantListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListTenantsParams {
  q?: string;
  status?: TenantListStatusKey;
  sort?: TenantListSortKey;
  page?: number;
  limit?: number;
}

export async function fetchSuperAdminTenants(
  params: ListTenantsParams,
): Promise<SuperAdminTenantsListResponse> {
  const { data } = await superAdminApi.get<SuperAdminTenantsListResponse>('/super-admin/tenants', {
    params,
  });
  return data;
}

// ─── Create tenant (C3.2) ──────────────────────────────────────────

export interface CreateTenantInput {
  brandName: string;
  legalName: string;
  voen: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  username?: string;
  themeColor?: string;
  contactPhone?: string;
  ePointMerchantId?: string;
  /** ISO datetime — pass null to clear, undefined to skip. */
  subscriptionStart?: string;
  subscriptionEnd?: string;
  /** Decimal string e.g. "1.00". */
  minChargeAmount?: string;
  chargeStep?: string;
}

export interface CreateTenantResponse {
  tenant: {
    id: string;
    brandName: string;
    legalName: string;
    voen: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    themeColor: string;
    status: TenantStatusKey;
    subscriptionStart: string | null;
    subscriptionEnd: string | null;
    createdAt: string;
  };
  tenantUser: {
    id: string;
    username: string;
    createdAt: string;
  };
  /** Plaintext password — shown to super-admin ONCE; never returned again. */
  generatedPassword: string;
}

export async function createSuperAdminTenant(
  payload: CreateTenantInput,
): Promise<CreateTenantResponse> {
  const { data } = await superAdminApi.post<CreateTenantResponse>('/super-admin/tenants', payload);
  return data;
}

// ─── Tenant detail (C4.1) ─────────────────────────────────────────

export interface SuperAdminTenantDetail {
  id: string;
  brandName: string;
  legalName: string;
  voen: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ePointMerchantId: string | null;
  themeColor: string;
  logoUrl: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  minChargeAmount: string;
  chargeStep: string;
  status: TenantStatusKey;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  user: {
    id: string;
    username: string;
    lastLoginAt: string | null;
  };
  counts: {
    locations: number;
    bays: number;
    transactions: number;
  };
}

export interface UpdateTenantInput {
  brandName?: string;
  legalName?: string;
  voen?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  themeColor?: string;
  contactPhone?: string | null;
  ePointMerchantId?: string | null;
  subscriptionStart?: string | null;
  subscriptionEnd?: string | null;
  minChargeAmount?: string;
  chargeStep?: string;
}

export async function fetchSuperAdminTenant(id: string): Promise<SuperAdminTenantDetail> {
  const { data } = await superAdminApi.get<SuperAdminTenantDetail>(`/super-admin/tenants/${id}`);
  return data;
}

export async function updateSuperAdminTenant(
  id: string,
  patch: UpdateTenantInput,
): Promise<SuperAdminTenantDetail> {
  const { data } = await superAdminApi.patch<SuperAdminTenantDetail>(
    `/super-admin/tenants/${id}`,
    patch,
  );
  return data;
}

export async function updateSuperAdminTenantStatus(
  id: string,
  status: TenantStatusKey,
): Promise<SuperAdminTenantDetail> {
  const { data } = await superAdminApi.patch<SuperAdminTenantDetail>(
    `/super-admin/tenants/${id}/status`,
    { status },
  );
  return data;
}

// ─── Audit logs (per-tenant activity feed) ─────────────────────────

export interface SuperAdminAuditLogRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SuperAdminAuditLogsResponse {
  items: SuperAdminAuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListAuditLogsParams {
  actorType?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchSuperAdminAuditLogs(
  params: ListAuditLogsParams,
): Promise<SuperAdminAuditLogsResponse> {
  const { data } = await superAdminApi.get<SuperAdminAuditLogsResponse>('/super-admin/audit-logs', {
    params,
  });
  return data;
}

export async function fetchSuperAdminAuditLog(id: string): Promise<SuperAdminAuditLogRow> {
  const { data } = await superAdminApi.get<SuperAdminAuditLogRow>(`/super-admin/audit-logs/${id}`);
  return data;
}

// ─── Subscriptions log (C5.1) ─────────────────────────────────────

export type SubscriptionMethodKey = 'bank_transfer' | 'cash' | 'other';

export interface SuperAdminSubscriptionRow {
  id: string;
  tenantId: string;
  tenantBrandName: string;
  amountAzn: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  method: string;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface SuperAdminSubscriptionsResponse {
  items: SuperAdminSubscriptionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListSubscriptionsParams {
  tenantId?: string;
  method?: SubscriptionMethodKey;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchSuperAdminSubscriptions(
  params: ListSubscriptionsParams,
): Promise<SuperAdminSubscriptionsResponse> {
  const { data } = await superAdminApi.get<SuperAdminSubscriptionsResponse>(
    '/super-admin/subscriptions',
    { params },
  );
  return data;
}

// ─── Create subscription entry (C5.2) ─────────────────────────────

export interface CreateSubscriptionInput {
  amountAzn: string;
  paidAt: string; // ISO date (YYYY-MM-DD)
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  method: SubscriptionMethodKey;
  notes?: string;
}

export interface CreateSubscriptionResponse {
  subscription: SuperAdminSubscriptionRow;
  tenant: {
    id: string;
    subscriptionStart: string | null;
    subscriptionEnd: string | null;
    bumped: boolean;
  };
}

export async function createSuperAdminSubscription(
  tenantId: string,
  payload: CreateSubscriptionInput,
): Promise<CreateSubscriptionResponse> {
  const { data } = await superAdminApi.post<CreateSubscriptionResponse>(
    `/super-admin/tenants/${tenantId}/subscriptions`,
    payload,
  );
  return data;
}

// ─── Platform analytics (C6.1) ────────────────────────────────────

export interface SuperAdminAnalyticsResponse {
  range: { from: string; to: string };
  revenue: {
    total: string;
    txCount: number;
    daily: Array<{ date: string; paidAmountAzn: string; txCount: number }>;
  };
  growth: {
    newTenants: Array<{ month: string; count: number }>;
    mrrByMonth: Array<{ month: string; amountAzn: string; subscriptionCount: number }>;
  };
  kpis: {
    newTenantsInRange: number;
    mrrInRange: string;
    mrrSubscriptionsInRange: number;
  };
  topTenants: Array<{
    tenantId: string;
    brandName: string;
    status: TenantStatusKey;
    paidAmountAzn: string;
    txCount: number;
  }>;
}

export interface AnalyticsParams {
  from?: string;
  to?: string;
}

export async function fetchSuperAdminAnalytics(
  params: AnalyticsParams,
): Promise<SuperAdminAnalyticsResponse> {
  const { data } = await superAdminApi.get<SuperAdminAnalyticsResponse>('/super-admin/analytics', {
    params,
  });
  return data;
}

// ─── Push composer + history (C7.1 + C7.2) ─────────────────────────

export type PushTargetType = 'all' | 'city' | 'language';
export type PushStatus = 'queued' | 'scheduled' | 'sent';

export interface SuperAdminPushRow {
  id: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  targetType: PushTargetType;
  targetValues: string[];
  scheduledFor: string | null;
  sentAt: string | null;
  recipientsCount: number;
  deliveredCount: number;
  createdAt: string;
  status: PushStatus;
}

export interface SuperAdminPushListResponse {
  items: SuperAdminPushRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePushInput {
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  targetType: PushTargetType;
  targetValues?: string[];
  scheduledFor?: string | null;
}

export interface PushCity {
  city: string;
  customerCount: number;
}

export interface PushCitiesResponse {
  items: PushCity[];
}

export async function fetchSuperAdminPushHistory(params: {
  page?: number;
  pageSize?: number;
}): Promise<SuperAdminPushListResponse> {
  const { data } = await superAdminApi.get<SuperAdminPushListResponse>('/super-admin/push', {
    params,
  });
  return data;
}

export async function fetchSuperAdminPush(id: string): Promise<SuperAdminPushRow> {
  const { data } = await superAdminApi.get<SuperAdminPushRow>(`/super-admin/push/${id}`);
  return data;
}

export async function fetchSuperAdminPushCities(): Promise<PushCitiesResponse> {
  const { data } = await superAdminApi.get<PushCitiesResponse>('/super-admin/push/cities');
  return data;
}

export async function createSuperAdminPush(payload: CreatePushInput): Promise<SuperAdminPushRow> {
  const { data } = await superAdminApi.post<SuperAdminPushRow>('/super-admin/push', payload);
  return data;
}

// ─── Promos (C8.1 + C8.2) ──────────────────────────────────────────

export type PromoStatusKey = 'draft' | 'scheduled' | 'active' | 'expired';
export type PromoCtaTargetType = 'tenant' | 'external_url';
export type PromoThemeKey = 'blue' | 'violet' | 'teal' | 'amber';

export interface SuperAdminPromoRow {
  id: string;
  imageUrl: string | null;
  theme: string | null;
  sortOrder: number;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  ctaTextAz: string | null;
  ctaTextRu: string | null;
  ctaTextEn: string | null;
  ctaTargetType: PromoCtaTargetType | null;
  ctaTargetValue: string | null;
  startAt: string;
  endAt: string;
  status: PromoStatusKey;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminPromosListResponse {
  items: SuperAdminPromoRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListPromosParams {
  status?: PromoStatusKey;
  page?: number;
  pageSize?: number;
}

export interface CreatePromoInput {
  imageUrl?: string | null;
  theme?: PromoThemeKey | null;
  sortOrder?: number;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  ctaTextAz?: string | null;
  ctaTextRu?: string | null;
  ctaTextEn?: string | null;
  ctaTargetType?: PromoCtaTargetType | null;
  ctaTargetValue?: string | null;
  startAt: string;
  endAt: string;
  status?: Exclude<PromoStatusKey, 'expired'>;
}

export interface UpdatePromoInput {
  imageUrl?: string | null;
  theme?: PromoThemeKey | null;
  sortOrder?: number;
  titleAz?: string;
  titleRu?: string;
  titleEn?: string;
  bodyAz?: string;
  bodyRu?: string;
  bodyEn?: string;
  ctaTextAz?: string | null;
  ctaTextRu?: string | null;
  ctaTextEn?: string | null;
  ctaTargetType?: PromoCtaTargetType | null;
  ctaTargetValue?: string | null;
  startAt?: string;
  endAt?: string;
}

export async function fetchSuperAdminPromos(
  params: ListPromosParams,
): Promise<SuperAdminPromosListResponse> {
  const { data } = await superAdminApi.get<SuperAdminPromosListResponse>('/super-admin/promos', {
    params,
  });
  return data;
}

export async function fetchSuperAdminPromo(id: string): Promise<SuperAdminPromoRow> {
  const { data } = await superAdminApi.get<SuperAdminPromoRow>(`/super-admin/promos/${id}`);
  return data;
}

export async function createSuperAdminPromo(
  payload: CreatePromoInput,
): Promise<SuperAdminPromoRow> {
  const { data } = await superAdminApi.post<SuperAdminPromoRow>('/super-admin/promos', payload);
  return data;
}

export async function updateSuperAdminPromo(
  id: string,
  patch: UpdatePromoInput,
): Promise<SuperAdminPromoRow> {
  const { data } = await superAdminApi.patch<SuperAdminPromoRow>(
    `/super-admin/promos/${id}`,
    patch,
  );
  return data;
}

export async function updateSuperAdminPromoStatus(
  id: string,
  status: PromoStatusKey,
): Promise<SuperAdminPromoRow> {
  const { data } = await superAdminApi.patch<SuperAdminPromoRow>(
    `/super-admin/promos/${id}/status`,
    { status },
  );
  return data;
}

export async function deleteSuperAdminPromo(id: string): Promise<void> {
  await superAdminApi.delete(`/super-admin/promos/${id}`);
}

// ─── Featured tenants (C9.1) ───────────────────────────────────────

export interface SuperAdminFeaturedRow {
  tenantId: string;
  sortOrder: number;
  createdAt: string;
  tenant: {
    id: string;
    brandName: string;
    logoUrl: string | null;
    themeColor: string;
    status: TenantStatusKey;
    isDeleted: boolean;
  };
}

export interface ReorderFeaturedInput {
  items: Array<{ tenantId: string; sortOrder: number }>;
}

export async function fetchSuperAdminFeatured(): Promise<SuperAdminFeaturedRow[]> {
  const { data } = await superAdminApi.get<SuperAdminFeaturedRow[]>('/super-admin/featured');
  return data;
}

export async function addSuperAdminFeatured(tenantId: string): Promise<void> {
  await superAdminApi.post('/super-admin/featured', { tenantId });
}

export async function reorderSuperAdminFeatured(
  payload: ReorderFeaturedInput,
): Promise<SuperAdminFeaturedRow[]> {
  const { data } = await superAdminApi.patch<SuperAdminFeaturedRow[]>(
    '/super-admin/featured/reorder',
    payload,
  );
  return data;
}

export async function removeSuperAdminFeatured(tenantId: string): Promise<void> {
  await superAdminApi.delete(`/super-admin/featured/${tenantId}`);
}

// ─── Platform settings (C10.1 + C10.2) ────────────────────────────

export const PLATFORM_SETTING_KEYS = [
  'tahawash.logoUrl',
  'tahawash.brandColor',
  'support.whatsappNumber',
  'support.email',
  'support.hours',
] as const;

export type PlatformSettingKey = (typeof PLATFORM_SETTING_KEYS)[number];

export type PlatformSettingsMap = Partial<Record<PlatformSettingKey, string>>;

export interface UpdatePlatformSettingsInput {
  items: Array<{ key: PlatformSettingKey; value: string }>;
}

export async function fetchSuperAdminSettings(): Promise<PlatformSettingsMap> {
  const { data } = await superAdminApi.get<PlatformSettingsMap>('/super-admin/settings');
  return data;
}

export async function updateSuperAdminSettings(
  payload: UpdatePlatformSettingsInput,
): Promise<PlatformSettingsMap> {
  const { data } = await superAdminApi.patch<PlatformSettingsMap>('/super-admin/settings', payload);
  return data;
}

// ─── App version / force update (C10.3) ───────────────────────────

export type AppPlatform = 'ios' | 'android';

export interface AppVersionRow {
  platform: AppPlatform;
  latestVersion: string;
  minimumVersion: string;
  releaseNotes: string | null;
  updatedAt: string;
}

export interface AppVersionResponse {
  ios: AppVersionRow | null;
  android: AppVersionRow | null;
}

export interface UpsertAppVersionInput {
  latestVersion: string;
  minimumVersion: string;
  releaseNotes?: string | null;
}

export async function fetchSuperAdminVersions(): Promise<AppVersionResponse> {
  const { data } = await superAdminApi.get<AppVersionResponse>('/super-admin/version');
  return data;
}

export async function upsertSuperAdminVersion(
  platform: AppPlatform,
  payload: UpsertAppVersionInput,
): Promise<AppVersionRow> {
  const { data } = await superAdminApi.put<AppVersionRow>(
    `/super-admin/version/${platform}`,
    payload,
  );
  return data;
}

// ─── Legal documents (C10.4) ──────────────────────────────────────

export const LEGAL_DOC_TYPES = ['terms', 'privacy'] as const;
export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

export const LEGAL_LANGUAGES = ['az', 'ru', 'en'] as const;
export type LegalLanguage = (typeof LEGAL_LANGUAGES)[number];

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocumentRow {
  id: string;
  type: LegalDocType;
  language: LegalLanguage;
  version: number;
  sections: LegalSection[];
  publishedAt: string;
  publishedBy: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export type LegalCurrentMap = Record<LegalDocType, Record<LegalLanguage, LegalDocumentRow | null>>;

export interface PublishLegalDocumentInput {
  sections: LegalSection[];
}

export async function fetchSuperAdminLegalCurrent(): Promise<LegalCurrentMap> {
  const { data } = await superAdminApi.get<LegalCurrentMap>('/super-admin/legal/current');
  return data;
}

export async function fetchSuperAdminLegalVersions(
  type: LegalDocType,
  language: LegalLanguage,
): Promise<{ items: LegalDocumentRow[] }> {
  const { data } = await superAdminApi.get<{ items: LegalDocumentRow[] }>(
    `/super-admin/legal/${type}/${language}`,
  );
  return data;
}

export async function publishSuperAdminLegal(
  type: LegalDocType,
  language: LegalLanguage,
  payload: PublishLegalDocumentInput,
): Promise<LegalDocumentRow> {
  const { data } = await superAdminApi.post<LegalDocumentRow>(
    `/super-admin/legal/${type}/${language}`,
    payload,
  );
  return data;
}

export async function makeSuperAdminLegalCurrent(id: string): Promise<LegalDocumentRow> {
  const { data } = await superAdminApi.post<LegalDocumentRow>(
    `/super-admin/legal/${id}/make-current`,
  );
  return data;
}
