import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Drop-in NestJS guard for customer-authenticated endpoints.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me') foo(@CurrentCustomer() c: CustomerPrincipal) { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
