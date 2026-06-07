import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PLATFORM_SETTING_KEYS } from '../settings.constants';

export class SettingItemDto {
  @ApiProperty({
    description: 'Setting key. Must be one of the known platform setting keys.',
    enum: PLATFORM_SETTING_KEYS,
  })
  @IsString()
  @MaxLength(120)
  key!: string;

  @ApiProperty({
    description:
      'New value. Empty string clears the value (row is deleted, GET returns no entry for this key).',
  })
  @IsString()
  @MaxLength(2000)
  value!: string;
}

/**
 * Bulk update payload — admin sends only the keys that actually
 * changed (diff-only PATCH, same pattern as Phase 3 BrandingPage).
 *
 * Unknown keys (not in PLATFORM_SETTING_KEYS) get a 400 UNKNOWN_KEY
 * so a typo at the admin side fails loudly.
 */
export class UpdatePlatformSettingsDto {
  @ApiProperty({ type: () => [SettingItemDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  items!: SettingItemDto[];
}
