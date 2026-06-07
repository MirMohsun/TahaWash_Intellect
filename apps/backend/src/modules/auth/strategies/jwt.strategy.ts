import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Actor } from '../../../common/actor.types';
import type { Env } from '../../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import type { CustomerJwtPayload } from '../auth.types';

/**
 * Customer JWT strategy.
 *
 * Verifies the access token from the Authorization header and resolves it to
 * a live Customer row. Rejects if the customer was deleted (deletedAt set).
 *
 * Returns a typed Actor — RequestContextInterceptor reads `request.user` to
 * populate the AsyncLocalStorage context that the Prisma scoping extension
 * relies on.
 *
 * IMPORTANT — uses `this.prisma` (raw, unscoped) NOT `this.prisma.scoped`:
 * Passport runs `validate()` BEFORE the RequestContextInterceptor sets an
 * actor. The scoping extension would default to ANONYMOUS deny on scoped
 * models. We observed in production that `RequestContext.withBypass(...)`
 * doesn't reliably propagate the bypass flag through passport-jwt's
 * internal promise chain into Prisma's microtask-scheduled extension
 * (see tenant-jwt.strategy.ts). Customer isn't currently in the scoped-
 * models set, but using the raw client here is consistent + future-proof.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: CustomerJwtPayload): Promise<Actor> {
    if (payload.type !== 'customer') {
      throw new UnauthorizedException({ code: 'WRONG_TOKEN_TYPE' });
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || customer.deletedAt) {
      throw new UnauthorizedException({ code: 'CUSTOMER_NOT_FOUND' });
    }
    return { type: 'customer', id: customer.id, phone: customer.phone };
  }
}
