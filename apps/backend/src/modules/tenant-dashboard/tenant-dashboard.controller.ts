import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { TenantDashboardService } from './tenant-dashboard.service';

@ApiTags('tenant · dashboard')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/dashboard')
export class TenantDashboardController {
  constructor(private readonly dashboard: TenantDashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Tenant dashboard rollup (today + 7-day + bay stats + recent activity)',
    description:
      'Returns everything the tenant admin dashboard needs in a single response: ' +
      "today's revenue/tx/hardware-error counts, daily revenue series for the " +
      'last 7 Baku calendar days, bay-active stats, top 5 bays this month, ' +
      'and the last 10 transactions. Tenant scoping is enforced by the Prisma extension.',
  })
  async get() {
    return this.dashboard.getDashboard();
  }
}
