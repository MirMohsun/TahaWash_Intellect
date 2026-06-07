import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, Max } from 'class-validator';

export class ListPromosQueryDto {
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

  @ApiPropertyOptional({ enum: ['draft', 'scheduled', 'active', 'expired'] })
  @IsOptional()
  @IsIn(['draft', 'scheduled', 'active', 'expired'])
  status?: 'draft' | 'scheduled' | 'active' | 'expired';
}
