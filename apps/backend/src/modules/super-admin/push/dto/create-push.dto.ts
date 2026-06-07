import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Super-admin payload for composing a bulk push notification.
 *
 * Multi-language is mandatory: every campaign carries all three locales
 * (AZ/RU/EN) and the delivery worker picks per-recipient based on the
 * customer's Customer.language. No fallback to a single-language post.
 *
 * Scheduling:
 *   - `scheduledFor` null → delivered immediately
 *   - `scheduledFor` future → BullMQ delay until that instant
 *   - `scheduledFor` past → rejected (no point sending late)
 */
export class CreatePushDto {
  @ApiProperty({ example: 'Yeni avtomobil yuyucusu!' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  titleAz!: string;

  @ApiProperty({ example: 'Новая автомойка!' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  titleRu!: string;

  @ApiProperty({ example: 'New carwash!' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  titleEn!: string;

  @ApiProperty({ example: 'Bakı 28 May-da açıldı. İlk yuma 50% endirim!' })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  bodyAz!: string;

  @ApiProperty({ example: 'Открылась на Баку 28 Мая. Первая мойка -50%!' })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  bodyRu!: string;

  @ApiProperty({ example: 'Opened on 28 May, Baku. First wash 50% off!' })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  bodyEn!: string;

  /**
   * Targeting strategy. `all` ignores targetValues; `city` / `language`
   * require non-empty targetValues.
   */
  @ApiProperty({ enum: ['all', 'city', 'language'] })
  @IsIn(['all', 'city', 'language'])
  targetType!: 'all' | 'city' | 'language';

  @ApiPropertyOptional({
    description:
      'Cities (when targetType="city") or language codes (when "language"). Ignored for "all".',
    example: ['Bakı', 'Gəncə'],
  })
  @ValidateIf((o: CreatePushDto) => o.targetType !== 'all')
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  targetValues?: string[];

  @ApiPropertyOptional({
    description: 'ISO datetime. Null/omitted = deliver now. Must be in the future if set.',
    example: '2026-06-01T08:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string | null;
}
