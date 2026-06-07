import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor } from '../../../common/actor.types';

export type TenantPrincipal = Extract<Actor, { type: 'tenant' }>;

/**
 * Inject the authenticated tenant user into a controller method.
 * Requires {@link TenantAuthGuard}.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantPrincipal => {
    const request = ctx.switchToHttp().getRequest<{ user?: Actor }>();
    if (!request.user) {
      throw new Error(
        '@CurrentTenant() used on a route without TenantAuthGuard; request.user is undefined.',
      );
    }
    if (request.user.type !== 'tenant') {
      throw new Error(`@CurrentTenant() expects a tenant actor, got "${request.user.type}".`);
    }
    return request.user;
  },
);
