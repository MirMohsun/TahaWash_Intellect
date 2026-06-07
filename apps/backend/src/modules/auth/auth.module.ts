import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../../config/env.schema';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SuperAdminJwtStrategy } from './strategies/super-admin-jwt.strategy';
import { TenantJwtStrategy } from './strategies/tenant-jwt.strategy';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantAuthService } from './tenant-auth.service';

@Module({
  imports: [
    SmsModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        // Access & refresh tokens use different secrets in the service layer.
        // This module-level secret is only used as the default by JwtStrategy.
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_EXPIRY', { infer: true }) as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController, TenantAuthController, SuperAdminAuthController],
  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    TenantAuthService,
    TenantJwtStrategy,
    SuperAdminAuthService,
    SuperAdminJwtStrategy,
  ],
  exports: [
    AuthService,
    TenantAuthService,
    SuperAdminAuthService,
    JwtStrategy,
    TenantJwtStrategy,
    SuperAdminJwtStrategy,
  ],
})
export class AuthModule {}
