import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentSuperAdmin,
  type SuperAdminPrincipal,
} from '../../auth/decorators/current-super-admin.decorator';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions.query';
import { SuperAdminSubscriptionsService } from './super-admin-subscriptions.service';

@ApiTags('super-admin · subscriptions')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin')
export class SuperAdminSubscriptionsController {
  constructor(private readonly subscriptions: SuperAdminSubscriptionsService) {}

  @Get('subscriptions')
  @ApiOperation({
    summary: 'List manual subscription payments across all tenants',
    description:
      'Cross-tenant subscription payment log. Filters: tenantId, method, ' +
      'paidAt range. Sorted newest-first. Page size 50 default, max 200.',
  })
  async list(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptions.list(query);
  }

  @Post('tenants/:tenantId/subscriptions')
  @ApiOperation({
    summary: 'Record a manual subscription payment for a tenant (C5.2)',
    description:
      "Inserts a Subscription row and — if the new periodEnd is later than the tenant's " +
      'current subscriptionEnd — bumps subscriptionEnd to renew them. Writes an audit-log ' +
      'row (super_admin · subscription.create · resourceType=tenant).',
  })
  @ApiResponse({ status: 201, description: 'Subscription recorded; tenant may have been renewed.' })
  @ApiResponse({ status: 400, description: 'periodEnd <= periodStart.' })
  @ApiResponse({ status: 404, description: 'Tenant not found.' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateSubscriptionDto,
    @CurrentSuperAdmin() admin: SuperAdminPrincipal,
  ) {
    return this.subscriptions.create(tenantId, dto, admin.id);
  }
}
