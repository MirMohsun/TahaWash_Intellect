/**
 * Actor — the authenticated entity behind a request.
 *
 * All four shapes carry the minimal info needed to scope DB queries and
 * decide what an endpoint should reveal. The whole multi-tenancy system
 * pivots on this discriminated union.
 *
 * Set per request by RequestContextInterceptor from the JWT (or anonymous
 * if no/invalid token). Read by Prisma extension + service code via
 * `RequestContext.currentOrThrow()` / `RequestContext.current()`.
 */
export type Actor =
  | {
      type: 'customer';
      id: string;
      phone: string;
    }
  | {
      type: 'tenant';
      id: string; // TenantUser.id
      tenantId: string; // the tenant the user manages
      username: string;
    }
  | {
      type: 'super_admin';
      id: string;
      username: string;
    }
  | {
      type: 'anonymous';
    };

export type AuthenticatedActor = Exclude<Actor, { type: 'anonymous' }>;

export const ANONYMOUS_ACTOR: Actor = { type: 'anonymous' };
