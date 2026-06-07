import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const TENANT_LIST_STATUSES = [
  'pending',
  'active',
  'suspended',
  'hidden',
  'expired',
] as const;
export type TenantListStatus = (typeof TENANT_LIST_STATUSES)[number];

export const TENANT_LIST_SORTS = [
  'createdAt:desc',
  'createdAt:asc',
  'brandName:asc',
  'brandName:desc',
  'subscriptionEnd:asc',
  'subscriptionEnd:desc',
] as const;
export type TenantListSort = (typeof TENANT_LIST_SORTS)[number];

export class ListTenantsQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search across brandName / legalName / voen' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      'Status filter. `expired` is derived (subscriptionEnd < now) and orthogonal to real status enum.',
    enum: TENANT_LIST_STATUSES,
  })
  @IsOptional()
  @IsIn([...TENANT_LIST_STATUSES])
  status?: TenantListStatus;

  @ApiPropertyOptional({
    enum: TENANT_LIST_SORTS,
    default: 'createdAt:desc',
  })
  @IsOptional()
  @IsIn([...TENANT_LIST_SORTS])
  sort?: TenantListSort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
