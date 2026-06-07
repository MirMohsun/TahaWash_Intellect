import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * Status transitions handled here (matches the Prisma TenantStatus enum):
 *   pending   → active (initial activation)
 *   active    ↔ suspended (non-payment / restored)
 *   any       → hidden (admin removes from map entirely)
 */
export class UpdateTenantStatusDto {
  @ApiProperty({ enum: ['pending', 'active', 'suspended', 'hidden'] })
  @IsIn(['pending', 'active', 'suspended', 'hidden'])
  status!: 'pending' | 'active' | 'suspended' | 'hidden';
}
