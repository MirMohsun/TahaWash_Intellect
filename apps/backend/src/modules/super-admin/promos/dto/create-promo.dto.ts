import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Super-admin payload for a new promo banner.
 *
 * The mobile app shows promos that are status='active' AND
 * startAt <= now <= endAt. Super-admins typically:
 *   1. Create as 'draft' while drafting copy + image
 *   2. Flip to 'active' (or 'scheduled' if startAt is future)
 *   3. Auto-expire is handled by a cron (Phase 1.10c) that flips
 *      anything past endAt to 'expired'
 *
 * Per spec: imageUrl is required (banner has no text-only mode).
 * Per spec round 7 final: promos are images + copy, not feature cards.
 */
const PROMO_THEMES = ['blue', 'violet', 'teal', 'amber'] as const;

export class CreatePromoDto {
  @ApiPropertyOptional({
    description: 'Promo banner image URL. Optional — omit (or null) for a colored gradient banner.',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    enum: PROMO_THEMES,
    description: 'Banner color theme — used when there is no image (defaults by position if unset).',
  })
  @IsOptional()
  @IsIn(PROMO_THEMES)
  theme?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Carousel display order (ascending). Lower shows first. Defaults to 0.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiProperty({ example: 'Yeni avtomobil yuyucusu Bakıda' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  titleAz!: string;

  @ApiProperty({ example: 'Новая автомойка в Баку' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  titleRu!: string;

  @ApiProperty({ example: 'New carwash in Baku' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  titleEn!: string;

  @ApiProperty({ example: 'İlk yumada 50% endirim. May ayının sonuna qədər.' })
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  bodyAz!: string;

  @ApiProperty({ example: 'Скидка 50% на первую мойку. До конца мая.' })
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  bodyRu!: string;

  @ApiProperty({ example: '50% off your first wash. Through end of May.' })
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  bodyEn!: string;

  @ApiPropertyOptional({ example: 'İndi cəhd et' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaTextAz?: string | null;

  @ApiPropertyOptional({ example: 'Попробуйте сейчас' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaTextRu?: string | null;

  @ApiPropertyOptional({ example: 'Try now' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaTextEn?: string | null;

  @ApiPropertyOptional({ enum: ['tenant', 'external_url'] })
  @IsOptional()
  @IsIn(['tenant', 'external_url'])
  ctaTargetType?: 'tenant' | 'external_url' | null;

  @ApiPropertyOptional({
    description: 'tenantId when ctaTargetType=tenant, URL when external_url',
  })
  @ValidateIf((o: CreatePromoDto) => o.ctaTargetType != null)
  @IsString()
  @MaxLength(500)
  ctaTargetValue?: string | null;

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ example: '2026-06-30T23:59:59.000Z' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ enum: ['draft', 'scheduled', 'active'], default: 'draft' })
  @IsOptional()
  @IsIn(['draft', 'scheduled', 'active'])
  status?: 'draft' | 'scheduled' | 'active';
}
