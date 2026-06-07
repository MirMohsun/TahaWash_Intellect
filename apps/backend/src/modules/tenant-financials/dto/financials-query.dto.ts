import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

const BAKU_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date range for the financials rollup. Both bounds are Baku calendar
 * days; service-side converts to UTC instants. Defaults to the last
 * 30 Baku days when both are omitted.
 */
export class FinancialsQueryDto {
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
