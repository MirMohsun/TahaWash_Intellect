import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Actor } from '../../../common/actor.types';
import type { Env } from '../../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantJwtPayload } from '../auth.types';

/**
 * Tenant JWT strategy — registered under the Passport name `tenant-jwt`.
 *
 * Resolves the access token to a live TenantUser + Tenant pair. Rejects if
 * the tenant has been deleted or hidden.
 *
 * IMPORTANT — uses `this.prisma` (raw, unscoped) NOT `this.prisma.scoped`:
 * Passport runs `validate()` BEFORE the RequestContextInterceptor has set
 * up the actor, so the scoping extension would default to ANONYMOUS
 * (deny-all) on every JWT verify. In production we observed
 * `RequestContext.withBypass(...)` failing to propagate the bypass flag
 * through Prisma's microtask-based extension chain, causing the deny
 * filter to wrap the WHERE clause and break the findUnique unique-input
 * shape. Using the raw client sidesteps the extension entirely — safe
 * here because we explicitly filter by JWT-supplied id + verify tenant
 * status in this same method.
 */
@Injectable()
export class TenantJwtStrategy extends PassportStrategy(Strategy, 'tenant-jwt') {
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

  async validate(payload: TenantJwtPayload): Promise<Actor> {
    if (payload.type !== 'tenant') {
      throw new UnauthorizedException({ code: 'WRONG_TOKEN_TYPE' });
    }
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'TENANT_USER_NOT_FOUND' });
    }
    if (user.tenant.deletedAt || user.tenant.status === 'hidden') {
      throw new UnauthorizedException({ code: 'TENANT_UNAVAILABLE' });
    }
    return {
      type: 'tenant',
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
    };
  }
}
