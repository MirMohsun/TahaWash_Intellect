import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WorkingHoursDto } from './working-hours.dto';

const AZ_PHONE = /^\+994\d{9}$/;

export class CreateLocationDto {
  @ApiProperty({ example: 'YuBox · Bakı 28 May' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '28 May küç., Nəsimi r-nu, Bakı' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  address!: string;

  @ApiProperty({ example: 40.3796 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 49.8485 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ example: '+994 12 555 88 44' })
  @IsOptional()
  @IsString()
  @Matches(AZ_PHONE, { message: 'contactPhone must be +994XXXXXXXXX' })
  contactPhone?: string;

  @ApiPropertyOptional({
    description: '24/7 toggle. When true, workingHours is ignored.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is24_7?: boolean;

  @ApiPropertyOptional({
    description: 'Per-day working hours. Ignored when is24_7=true.',
    type: WorkingHoursDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDto)
  workingHours?: WorkingHoursDto | null;
}
