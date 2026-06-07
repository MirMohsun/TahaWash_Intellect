import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Shared shape for username + password login (tenants + super-admins).
 *
 * No regex on username — tenant usernames are auto-suggested from brand name
 * by super-admin; we just need basic length sanity. Password length only
 * sanity-checks; full strength rules live at password-set time.
 */
export class UsernamePasswordLoginDto {
  @ApiProperty({ example: 'yubox' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'tahawash-dev-2026' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
