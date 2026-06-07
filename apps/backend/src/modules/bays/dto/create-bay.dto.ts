import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBayDto {
  @ApiProperty({
    example: 'Bay 3',
    description: 'Human label printed on the QR sticker',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Hardware identifier (serial / IMEI). Optional — set later once the hardware module is wired.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hardwareIdentifier?: string;
}
