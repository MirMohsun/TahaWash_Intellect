import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { TenantSubscriptionsService } from './tenant-subscriptions.service';

@ApiTags('tenant · subscriptions')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/subscriptions')
export class TenantSubscriptionsController {
  constructor(private readonly subs: TenantSubscriptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List subscription payment history for the current tenant',
    description:
      'Returns every Subscription row Tahawash super-admin has recorded ' +
      'for this tenant, newest-paidAt first. Active-period dates still ' +
      'come from /tenant/me — this is the historical payment log.',
  })
  async list() {
    return this.subs.listForCurrentTenant();
  }
}
