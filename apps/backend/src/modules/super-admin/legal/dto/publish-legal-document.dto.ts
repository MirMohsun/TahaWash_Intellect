import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LegalSectionDto {
  @ApiProperty({ example: '1. About Tahawash' })
  @IsString()
  @MinLength(1, { message: 'Section heading is required.' })
  @MaxLength(200)
  heading!: string;

  @ApiProperty({ example: 'Tahawash is a self-service carwash payment platform...' })
  @IsString()
  @MinLength(1, { message: 'Section body is required.' })
  @MaxLength(10000)
  body!: string;
}

export class PublishLegalDocumentDto {
  @ApiProperty({
    type: [LegalSectionDto],
    description:
      'Ordered list of sections. Each is rendered as a card row on the mobile legal screen.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one section is required.' })
  @ValidateNested({ each: true })
  @Type(() => LegalSectionDto)
  sections!: LegalSectionDto[];
}
