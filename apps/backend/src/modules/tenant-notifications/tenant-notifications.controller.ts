import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant, type TenantPrincipal } from '../auth/decorators/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { TenantNotificationsService } from './tenant-notifications.service';

@ApiTags('tenant · notifications')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/notifications')
export class TenantNotificationsController {
  constructor(private readonly notifications: TenantNotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List in-panel notifications derived from current tenant state',
    description:
      'Computed live from tenant.status, subscription dates, and recent ' +
      'hardware errors — no separate Notification table. Each item has ' +
      'a deterministic id so the client can persist dismissals locally.',
  })
  async list(@CurrentTenant() actor: TenantPrincipal) {
    return this.notifications.listForCurrentTenant(actor.tenantId);
  }
}
