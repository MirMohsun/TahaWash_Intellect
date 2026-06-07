import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SUBSCRIPTION_METHODS, type SubscriptionMethod } from './list-subscriptions.query';

const DECIMAL_POSITIVE = /^(?!0(\.0+)?$)\d+(\.\d{1,2})?$/;

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Amount paid in AZN as a decimal string, must be > 0.' })
  @IsString()
  @Type(() => String)
  @Matches(DECIMAL_POSITIVE, {
    message: 'amountAzn must be a positive decimal string (e.g. "120.00")',
  })
  amountAzn!: string;

  @ApiProperty({ description: 'ISO date the payment was received.' })
  @IsDateString()
  paidAt!: string;

  @ApiProperty({ description: 'ISO date the subscription period starts.' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'ISO date the subscription period ends. Must be after periodStart.' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty({ enum: SUBSCRIPTION_METHODS })
  @IsIn([...SUBSCRIPTION_METHODS])
  method!: SubscriptionMethod;

  @ApiPropertyOptional({ description: 'Free-text notes (bank ref, batch id, etc.).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
