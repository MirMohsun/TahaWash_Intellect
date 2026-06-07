import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Fields a CUSTOMER can update on themselves.
 *
 * INTENTIONALLY EXCLUDES:
 *   - phone   → changing phone requires a new OTP flow (Phase 2)
 *   - city    → set server-side from app once we have city detection
 *   - createdAt / deletedAt → never user-editable
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Elvin' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string | null;

  @ApiPropertyOptional({ enum: ['az', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['az', 'ru', 'en'])
  language?: 'az' | 'ru' | 'en';

  @ApiPropertyOptional({ description: 'FCM push token (set after permission grant)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pushToken?: string | null;

  @ApiPropertyOptional({ enum: ['ios', 'android'] })
  @IsOptional()
  @IsIn(['ios', 'android'])
  pushPlatform?: 'ios' | 'android' | null;
}
