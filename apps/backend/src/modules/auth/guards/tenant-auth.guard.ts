import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guards a route to authenticated tenant owners only.
 *
 * Usage:
 *   @UseGuards(TenantAuthGuard)
 *   @Get('me') me(@CurrentTenant() t: TenantPrincipal) { ... }
 */
@Injectable()
export class TenantAuthGuard extends AuthGuard('tenant-jwt') {}
