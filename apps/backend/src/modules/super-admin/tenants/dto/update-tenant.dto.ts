import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsHexColor,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const AZ_PHONE = /^\+994\d{9}$/;
const VOEN_REGEX = /^\d{10}$/;
const DECIMAL_STRING = /^\d+(\.\d{1,2})?$/;

/**
 * Super-admin update payload. All fields optional — partial update.
 * To change status, use the dedicated /status endpoint (clearer audit trail).
 */
export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  brandName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(VOEN_REGEX, { message: 'voen must be 10 digits' })
  voen?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(AZ_PHONE, { message: 'ownerPhone must be +994XXXXXXXXX' })
  ownerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  themeColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ePointMerchantId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  subscriptionStart?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  subscriptionEnd?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => String)
  @Matches(DECIMAL_STRING)
  minChargeAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => String)
  @Matches(DECIMAL_STRING)
  chargeStep?: string;
}
