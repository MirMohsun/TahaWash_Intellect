import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const BAKU_DATE = /^\d{4}-\d{2}-\d{2}$/;

const TX_STATUSES = [
  'pending',
  'paid_crediting',
  'paid_credited',
  'paid_hardware_error',
  'declined',
  'cancelled',
] as const;
export type TransactionStatusFilter = (typeof TX_STATUSES)[number];

/**
 * Query DTO for GET /tenant/transactions and /tenant/transactions/export.csv.
 *
 * Dates are Baku-calendar strings ("YYYY-MM-DD") interpreted as the start
 * (from) / end (to) of those calendar days in UTC+4. Service-side
 * conversion lives in tenant-transactions.service.ts.
 */
export class ListTenantTransactionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional({ enum: TX_STATUSES })
  @IsOptional()
  @IsEnum(TX_STATUSES)
  status?: TransactionStatusFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bayId?: string;

  @ApiPropertyOptional({ description: 'Baku date inclusive lower bound (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(BAKU_DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ description: 'Baku date inclusive upper bound (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(BAKU_DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
