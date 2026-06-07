import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentTenant, type TenantPrincipal } from './decorators/current-tenant.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsernamePasswordLoginDto } from './dto/username-password-login.dto';
import { TenantAuthGuard } from './guards/tenant-auth.guard';
import { TenantAuthService } from './tenant-auth.service';

@ApiTags('auth · tenant')
@Controller('auth/tenant')
export class TenantAuthController {
  constructor(private readonly auth: TenantAuthService) {}

  /**
   * Tenant owner login with username + password.
   *
   * Account is created by super-admin (no self-signup, per spec).
   * Rate-limited at 10 attempts per 5 minutes per IP to slow brute force.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @ApiOperation({ summary: 'Tenant owner login' })
  @ApiResponse({ status: 200, description: 'Logged in, tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or unavailable tenant' })
  async login(@Body() dto: UsernamePasswordLoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  /** Rotate refresh token. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate tenant refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** Revoke a refresh token (logout). */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tenant logout — revoke refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  /**
   * Request a password reset email.
   *
   * Always returns 200 regardless of whether the identifier matched — the
   * caller cannot distinguish "this username exists" from "it doesn't"
   * (prevents enumeration). Rate-limited at 5 / hr / IP to slow abuse.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Request a password-reset email' })
  @ApiResponse({ status: 204, description: 'Always returns 204 (no enumeration)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.usernameOrEmail);
  }

  /**
   * Exchange a reset token for a new password.
   * Same rate limit as login (10 / 5min / IP) — keeps brute-force in check.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiResponse({ status: 204, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Token invalid / expired / tenant unavailable' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }

  /**
   * Authenticated password change — verifies current password and revokes
   * every refresh token on success. Stricter rate limit than login to slow
   * targeted brute-force against an active session.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TenantAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change my password (revokes all refresh sessions)' })
  @ApiResponse({ status: 204, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'PASSWORD_INVALID — current password mismatch' })
  async changePassword(
    @CurrentTenant() actor: TenantPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(actor.id, dto.currentPassword, dto.newPassword);
  }

  /**
   * Revoke every refresh token for the current tenant user — "sign out
   * everywhere." The current access token stays valid until expiry;
   * clients typically clear their local token store right after.
   */
  @Post('logout-everywhere')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TenantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all refresh tokens for the current tenant user' })
  async logoutEverywhere(@CurrentTenant() actor: TenantPrincipal): Promise<void> {
    await this.auth.logoutEverywhere(actor.id);
  }

  /** Returns the authenticated tenant user (smoke test for the JWT pipeline). */
  @Get('me')
  @UseGuards(TenantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current tenant user (smoke test)' })
  async me(@CurrentTenant() tenant: TenantPrincipal) {
    return tenant;
  }
}
