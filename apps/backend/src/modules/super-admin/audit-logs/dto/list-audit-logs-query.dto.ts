import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional({ enum: ['super_admin', 'tenant', 'system'] })
  @IsOptional()
  @IsIn(['super_admin', 'tenant', 'system'])
  actorType?: 'super_admin' | 'tenant' | 'system';

  @ApiPropertyOptional({ description: 'Exact actor id (e.g. SuperAdminUser.id or TenantUser.id)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Action prefix match (e.g. "subscription." or "tenant.suspend")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @ApiPropertyOptional({ description: 'Resource type filter (e.g. "tenant", "promo", "bay")' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Resource id filter' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  resourceId?: string;

  @ApiPropertyOptional({ description: 'createdAt >= this ISO datetime' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'createdAt <= this ISO datetime' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
