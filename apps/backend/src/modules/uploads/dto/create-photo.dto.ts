import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsUrl, Max, Min } from 'class-validator';

/**
 * Body of `POST /tenant/me/photos` — the tenant just uploaded a file to
 * R2 and is now telling the backend "here's the resulting URL, save it
 * to the gallery". The URL is whatever R2 returned for the presigned PUT
 * (i.e. R2_PUBLIC_BASE_URL + key). Server doesn't strictly require it to
 * be inside the configured bucket — a tenant can paste in any URL and it
 * will display fine — but the delete endpoint can only clean up bucket-
 * owned objects.
 */
export class CreatePhotoDto {
  @ApiProperty({ example: 'https://cdn.tahawash.az/tenants/cl.../photo/171....jpg' })
  @IsUrl({ require_protocol: true })
  url!: string;

  @ApiProperty({ example: 0, required: false, description: 'Defaults to current max + 1.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiProperty({
    example: false,
    required: false,
    description: 'When true, ALL other photos for the tenant get isHero=false in the same transaction.',
  })
  @IsOptional()
  @IsBoolean()
  isHero?: boolean;
}
