import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderFeaturedItemDto {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderFeaturedDto {
  @ApiProperty({
    type: [ReorderFeaturedItemDto],
    description: 'Full new ordering. Tenants not in the list keep their existing sortOrder.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderFeaturedItemDto)
  items!: ReorderFeaturedItemDto[];
}
