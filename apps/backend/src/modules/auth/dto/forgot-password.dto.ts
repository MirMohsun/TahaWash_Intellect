import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Tenant forgot-password request body.
 *
 * Accepts username OR email — admin can type either. We never reveal which
 * one matched (or that anything matched at all) — see TenantAuthService
 * for the non-enumeration response contract.
 */
export class ForgotPasswordDto {
  @ApiProperty({
    example: 'yubox',
    description: 'Username or email associated with the tenant account.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  usernameOrEmail!: string;
}
