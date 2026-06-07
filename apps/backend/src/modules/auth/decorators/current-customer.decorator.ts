import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor } from '../../../common/actor.types';

/** A customer actor — narrowed for ergonomics in customer-only endpoints. */
export type CustomerPrincipal = Extract<Actor, { type: 'customer' }>;

/**
 * Inject the authenticated customer into a controller method.
 *
 * Requires JwtAuthGuard (the customer JWT strategy) on the route — otherwise
 * `request.user` is undefined.
 *
 * Defense-in-depth: throws if the actor is somehow not a customer (catches a
 * misconfigured route that accidentally lets through a different actor type).
 */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerPrincipal => {
    const request = ctx.switchToHttp().getRequest<{ user?: Actor }>();
    if (!request.user) {
      throw new Error(
        '@CurrentCustomer() used on a route without JwtAuthGuard; request.user is undefined.',
      );
    }
    if (request.user.type !== 'customer') {
      throw new Error(`@CurrentCustomer() expects a customer actor, got "${request.user.type}".`);
    }
    return request.user;
  },
);
