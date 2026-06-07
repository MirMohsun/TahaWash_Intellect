import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor } from '../actor.types';

/**
 * Inject the authenticated actor (any type — customer / tenant / super_admin).
 *
 * Prefer the more specific `@CurrentCustomer`, `@CurrentTenant`, or
 * `@CurrentSuperAdmin` decorators when the route is locked to one actor type.
 */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<{ user?: Actor }>();
  if (!request.user) {
    throw new Error(
      '@CurrentActor() used on a route without an auth guard; request.user is undefined.',
    );
  }
  return request.user;
});
