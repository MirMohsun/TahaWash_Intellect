import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor } from '../../../common/actor.types';

export type SuperAdminPrincipal = Extract<Actor, { type: 'super_admin' }>;

/**
 * Inject the authenticated super-admin into a controller method.
 * Requires {@link SuperAdminAuthGuard}.
 */
export const CurrentSuperAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SuperAdminPrincipal => {
    const request = ctx.switchToHttp().getRequest<{ user?: Actor }>();
    if (!request.user) {
      throw new Error(
        '@CurrentSuperAdmin() used on a route without SuperAdminAuthGuard; request.user is undefined.',
      );
    }
    if (request.user.type !== 'super_admin') {
      throw new Error(
        `@CurrentSuperAdmin() expects a super_admin actor, got "${request.user.type}".`,
      );
    }
    return request.user;
  },
);
