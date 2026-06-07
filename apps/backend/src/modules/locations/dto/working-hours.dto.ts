import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A single day's open/close window. Both required if the day is present. */
export class WorkingHoursDayDto {
  @IsString()
  @Matches(HH_MM, { message: 'open must be in HH:mm 24h format' })
  open!: string;

  @IsString()
  @Matches(HH_MM, { message: 'close must be in HH:mm 24h format' })
  close!: string;
}

/**
 * Per-day working hours.
 * Used when `is24_7=false` on Location. Each day can independently be null
 * (closed all day) or a WorkingHoursDayDto.
 */
export class WorkingHoursDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDayDto)
  mon?: WorkingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDayDto)
  tue?: WorkingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDayDto)
  wed?: WorkingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDayDto)
  thu?: WorkingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDayDto)
  fri?: WorkingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDayDto)
  sat?: WorkingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDayDto)
  sun?: WorkingHoursDayDto | null;
}
