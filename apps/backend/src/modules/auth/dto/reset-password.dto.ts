import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Tenant reset-password request body.
 *
 * `token` is the opaque string handed to the user via the reset email
 * (hashed in the DB; matched server-side via SHA-256). `newPassword`
 * length floor matches login DTO; production should also check strength
 * — left to a future hardening pass to avoid blocking MVP.
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset token issued by /auth/tenant/forgot-password (emailed to user).',
  })
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: 'a-fresh-password-2026' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
