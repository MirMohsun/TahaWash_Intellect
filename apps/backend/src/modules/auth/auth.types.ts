/**
 * Auth token contract returned to clients.
 * Access token is short-lived (15m default), refresh is long-lived (30d, rotated).
 */
export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number; // seconds
}

// ─── Customer (phone + OTP) ──────────────────────────────────────────────

export interface CustomerJwtPayload {
  sub: string; // customer id
  phone: string;
  type: 'customer';
}

export interface CustomerRefreshPayload {
  sub: string;
  jti: string;
  type: 'customer_refresh';
}

// ─── Tenant (username + password) ────────────────────────────────────────

export interface TenantJwtPayload {
  sub: string; // tenant user id
  tenantId: string;
  username: string;
  type: 'tenant';
}

export interface TenantRefreshPayload {
  sub: string; // tenant user id
  jti: string;
  type: 'tenant_refresh';
}

// ─── Super-admin (username + password) ───────────────────────────────────

export interface SuperAdminJwtPayload {
  sub: string; // super-admin user id
  username: string;
  type: 'super_admin';
}

export interface SuperAdminRefreshPayload {
  sub: string;
  jti: string;
  type: 'super_admin_refresh';
}
