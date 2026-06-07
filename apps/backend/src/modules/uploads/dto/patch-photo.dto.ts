import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Body of `PATCH /tenant/me/photos/:id` — used by the admin UI to flip
 * the hero badge or change ordering. Both fields are optional; an empty
 * body is rejected by class-validator's whitelist + the controller's
 * "at least one" check.
 */
export class PatchPhotoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiProperty({ required: false, description: 'Setting true demotes all other photos to false.' })
  @IsOptional()
  @IsBoolean()
  isHero?: boolean;
}
