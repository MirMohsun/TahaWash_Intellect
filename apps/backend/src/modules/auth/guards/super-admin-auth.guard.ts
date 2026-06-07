import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guards a route to authenticated super-admins only.
 *
 * Super-admin actors have NO tenantId — the Prisma scoping extension grants
 * them full visibility. Routes guarded by this MUST use the Prisma client
 * carefully: by default super-admin queries are unscoped (sees all rows).
 */
@Injectable()
export class SuperAdminAuthGuard extends AuthGuard('super-admin-jwt') {}
