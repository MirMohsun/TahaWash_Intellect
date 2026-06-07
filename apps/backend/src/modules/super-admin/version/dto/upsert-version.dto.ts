import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { VERSION_PATTERN } from '../version-compare';

/**
 * Payload for upserting the AppVersion row for a given platform.
 *
 * Versions are stored as "MAJOR.MINOR.PATCH" strings (no pre-release
 * suffixes) so the mobile force-update logic can compare them with the
 * compareVersions helper without pulling in a dep.
 */
export class UpsertVersionDto {
  @ApiProperty({ example: '1.2.0' })
  @IsString()
  @Matches(VERSION_PATTERN, { message: 'latestVersion must match "MAJOR.MINOR.PATCH"' })
  latestVersion!: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'Apps below this version are blocked with the force-update modal',
  })
  @IsString()
  @Matches(VERSION_PATTERN, { message: 'minimumVersion must match "MAJOR.MINOR.PATCH"' })
  minimumVersion!: string;

  @ApiPropertyOptional({ example: '— Bug fixes\n— Improved scanner reliability' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  releaseNotes?: string | null;
}
