import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description:
      'Inclusive lower bound on Transaction.createdAt (ISO date). Defaults to 90 Baku days ago.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Exclusive upper bound on Transaction.createdAt (ISO date). Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
