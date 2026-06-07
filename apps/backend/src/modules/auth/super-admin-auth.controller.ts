import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentSuperAdmin,
  type SuperAdminPrincipal,
} from './decorators/current-super-admin.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UsernamePasswordLoginDto } from './dto/username-password-login.dto';
import { SuperAdminAuthGuard } from './guards/super-admin-auth.guard';
import { SuperAdminAuthService } from './super-admin-auth.service';

@ApiTags('auth · super-admin')
@Controller('auth/super-admin')
export class SuperAdminAuthController {
  constructor(private readonly auth: SuperAdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @ApiOperation({ summary: 'Super-admin login' })
  @ApiResponse({ status: 200, description: 'Logged in, tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: UsernamePasswordLoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate super-admin refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Super-admin logout — revoke refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current super-admin (smoke test)' })
  async me(@CurrentSuperAdmin() admin: SuperAdminPrincipal) {
    return admin;
  }
}
