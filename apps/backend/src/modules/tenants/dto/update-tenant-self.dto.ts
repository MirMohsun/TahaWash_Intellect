import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsHexColor, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const DECIMAL_STRING = /^\d+(\.\d{1,2})?$/;

/**
 * Fields a TENANT can update on themselves.
 *
 * INTENTIONALLY EXCLUDES:
 *   - voen, legalName, ownerName, ownerEmail, ownerPhone → super-admin-only
 *   - status, subscriptionStart, subscriptionEnd → super-admin-only
 *   - username → super-admin-only (different endpoint will reset password)
 *   - ePointMerchantId → super-admin sets this, tenant just reads
 *
 * Allowed fields are brand presentation + the tenant-tunable counter config.
 */
export class UpdateTenantSelfDto {
  @ApiPropertyOptional({ description: 'Brand name (customer-facing)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  brandName?: string;

  @ApiPropertyOptional({ description: 'Theme color hex (#RRGGBB)' })
  @IsOptional()
  @IsHexColor()
  themeColor?: string;

  @ApiPropertyOptional({ description: 'URL of logo image (uploaded separately to R2)' })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Phone number shown on the public tenant page' })
  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAz?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionRu?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string | null;

  @ApiPropertyOptional({ description: 'Min charge amount in AZN ("1.00")' })
  @IsOptional()
  @Type(() => String)
  @Matches(DECIMAL_STRING)
  minChargeAmount?: string;

  @ApiPropertyOptional({ description: 'Charge increment step in AZN ("0.50")' })
  @IsOptional()
  @Type(() => String)
  @Matches(DECIMAL_STRING)
  chargeStep?: string;
}
