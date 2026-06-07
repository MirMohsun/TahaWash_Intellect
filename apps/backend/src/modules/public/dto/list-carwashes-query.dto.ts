import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, IsPositive, Max, Min } from 'class-validator';

/**
 * Query params for /public/carwashes.
 *
 * All optional. If centerLat + centerLng + radiusKm are all provided, the
 * response filters tenants/locations to those within the radius (Phase 1
 * uses a haversine post-filter; Phase 2 will use PostGIS ST_DWithin once we
 * see real load).
 */
export class ListCarwashesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ example: 40.3796 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  centerLat?: number;

  @ApiPropertyOptional({ example: 49.8485 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  centerLng?: number;

  @ApiPropertyOptional({ description: 'Filter radius in km (1–100)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(0.1)
  @Max(100)
  radiusKm?: number;
}
