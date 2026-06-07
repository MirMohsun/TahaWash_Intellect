import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class AppVersionQueryDto {
  @ApiProperty({ enum: ['ios', 'android'], example: 'ios' })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}
