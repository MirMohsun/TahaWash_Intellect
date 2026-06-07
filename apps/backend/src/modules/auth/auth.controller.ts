import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentCustomer, type CustomerPrincipal } from './decorators/current-customer.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth · customer')
@Controller('auth/customer')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Step 1 of login: send a 6-digit OTP to the given AZ phone number.
   *
   * Rate-limited at the route (10 req / 5 min IP) PLUS inside OtpService
   * (5 OTPs per phone per hour). 200 even if user doesn't exist — never
   * leak whether a phone is registered.
   */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 5 * 60_000 } })
  @ApiOperation({ summary: 'Send OTP to phone' })
  @ApiResponse({ status: 200, description: 'OTP sent (or appeared to be sent)' })
  @ApiResponse({ status: 400, description: 'Invalid phone or rate-limited' })
  async requestOtp(@Body() dto: RequestOtpDto): Promise<{ phone: string }> {
    return this.auth.requestCustomerOtp(dto.phone);
  }

  /**
   * Step 2: verify the OTP and receive access + refresh tokens. Creates the
   * Customer row if it didn't exist (first-time login).
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 5 * 60_000 } })
  @ApiOperation({ summary: 'Verify OTP, issue tokens' })
  @ApiResponse({ status: 200, description: 'Authenticated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyCustomerOtp(dto.phone, dto.code);
  }

  /** Rotate a refresh token. Old refresh is revoked; a new pair is issued. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshCustomerSession(dto.refreshToken);
  }

  /** Revoke a refresh token. Safe even with stale/invalid token. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout — revoke refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logoutCustomer(dto.refreshToken);
  }

  /** Returns the authenticated customer. Smoke test for the JWT pipeline. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current customer (smoke test)' })
  async me(@CurrentCustomer() customer: CustomerPrincipal) {
    return customer;
  }
}
