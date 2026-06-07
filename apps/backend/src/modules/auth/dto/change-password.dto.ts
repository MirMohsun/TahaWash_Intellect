import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Tenant user changes their own password.
 *
 * MinLength 8 / MaxLength 128 mirrors the login + reset DTOs. Production
 * could harden further (require digit + symbol, breach-list check) — left
 * to a future security pass; for MVP this matches the floor everywhere.
 */
export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password — proves identity before change.' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'a-fresh-password-2026' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
