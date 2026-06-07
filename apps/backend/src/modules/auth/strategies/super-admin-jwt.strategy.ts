import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Actor } from '../../../common/actor.types';
import type { Env } from '../../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import type { SuperAdminJwtPayload } from '../auth.types';

/**
 * Super-admin JWT strategy — registered under the Passport name `super-admin-jwt`.
 *
 * Uses raw `this.prisma` (not `this.prisma.scoped`) for the same reason
 * as tenant-jwt.strategy.ts: passport-jwt's internal async context can
 * break AsyncLocalStorage bypass propagation through Prisma's extension
 * microtasks. Super-admin actor bypasses scoping by default anyway, so
 * the raw client is equivalent here.
 */
@Injectable()
export class SuperAdminJwtStrategy extends PassportStrategy(Strategy, 'super-admin-jwt') {
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

  async validate(payload: SuperAdminJwtPayload): Promise<Actor> {
    if (payload.type !== 'super_admin') {
      throw new UnauthorizedException({ code: 'WRONG_TOKEN_TYPE' });
    }
    const user = await this.prisma.superAdminUser.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException({ code: 'SUPER_ADMIN_NOT_FOUND' });
    }
    return { type: 'super_admin', id: user.id, username: user.username };
  }
}
