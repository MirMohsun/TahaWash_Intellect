import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdatePromoStatusDto {
  @ApiProperty({ enum: ['draft', 'scheduled', 'active', 'expired'] })
  @IsIn(['draft', 'scheduled', 'active', 'expired'])
  status!: 'draft' | 'scheduled' | 'active' | 'expired';
}
