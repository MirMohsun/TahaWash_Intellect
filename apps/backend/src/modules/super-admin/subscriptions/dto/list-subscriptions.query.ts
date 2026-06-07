import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const SUBSCRIPTION_METHODS = ['bank_transfer', 'cash', 'other'] as const;
export type SubscriptionMethod = (typeof SUBSCRIPTION_METHODS)[number];

export class ListSubscriptionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter to a single tenant.' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ enum: SUBSCRIPTION_METHODS })
  @IsOptional()
  @IsIn([...SUBSCRIPTION_METHODS])
  method?: SubscriptionMethod;

  @ApiPropertyOptional({ description: 'Inclusive lower bound on paidAt (ISO).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Exclusive upper bound on paidAt (ISO).' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;
}
