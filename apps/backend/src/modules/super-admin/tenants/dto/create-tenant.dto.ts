import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
const VOEN_REGEX = /^\d{10}$/; // AZ legal entity tax ID

export class CreateTenantDto {
  @ApiProperty({ example: 'YuBox', description: 'Brand name shown to customers' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  brandName!: string;

  @ApiProperty({ example: 'MMC YuBox', description: 'Legal entity name (for invoices)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legalName!: string;

  @ApiProperty({ example: '1234567891', description: 'AZ tax ID (10 digits)' })
  @IsString()
  @Matches(VOEN_REGEX, { message: 'voen must be exactly 10 digits' })
  voen!: string;

  @ApiProperty({ example: 'Rustam Akbarli' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @ApiProperty({ example: 'owner@yubox.az' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: '+994501234567' })
  @IsString()
  @Matches(AZ_PHONE, { message: 'ownerPhone must be +994XXXXXXXXX' })
  ownerPhone!: string;

  @ApiPropertyOptional({
    example: 'yubox',
    description:
      'Optional login username. If omitted, slugified from brandName. Must be unique across all tenants.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'username must contain only lowercase letters, digits, hyphen, underscore',
  })
  username?: string;

  @ApiPropertyOptional({ example: '#0E7AE7' })
  @IsOptional()
  @IsHexColor()
  themeColor?: string;

  @ApiPropertyOptional({ example: '+994 12 555 88 44', description: 'Tenant page contact phone' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'ePoint merchant id (can be added later)' })
  @IsOptional()
  @IsString()
  ePointMerchantId?: string;

  @ApiPropertyOptional({ description: 'ISO datetime — start of paid subscription' })
  @IsOptional()
  @IsDateString()
  subscriptionStart?: string;

  @ApiPropertyOptional({ description: 'ISO datetime — end of paid subscription' })
  @IsOptional()
  @IsDateString()
  subscriptionEnd?: string;

  @ApiPropertyOptional({ description: 'Default min charge amount in AZN (string, "1.00")' })
  @IsOptional()
  @Type(() => String)
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'minChargeAmount must be a decimal string' })
  minChargeAmount?: string;

  @ApiPropertyOptional({ description: 'Default charge increment step in AZN (string, "0.50")' })
  @IsOptional()
  @Type(() => String)
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'chargeStep must be a decimal string' })
  chargeStep?: string;
}
