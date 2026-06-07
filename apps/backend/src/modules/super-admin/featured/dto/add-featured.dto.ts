import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddFeaturedDto {
  @ApiProperty({ description: 'Tenant id to add to the featured list' })
  @IsString()
  tenantId!: string;

  @ApiPropertyOptional({
    description: 'Sort order (lower = shown earlier). Omitted → appended to the end (max + 1).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
