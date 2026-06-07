import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

@ApiTags('super-admin · dashboard')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/dashboard')
export class SuperAdminDashboardController {
  constructor(private readonly dashboard: SuperAdminDashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Platform dashboard rollup (tenants · devices · tx · MRR · growth · watchlist · activity)',
    description:
      'Returns everything the super-admin platform dashboard needs in a single response: ' +
      'tenant counts by status, live device count, paid transaction totals (today + this month), ' +
      'MRR derived from the last-30-day subscription log, 6-month tenant growth series, ' +
      'subscription expiry watchlist (next 14 Baku days + already-expired), and the most ' +
      'recent 10 audit-log rows. Super-admin actors bypass tenant scoping — this endpoint ' +
      'reads across all tenants.',
  })
  async get() {
    return this.dashboard.getDashboard();
  }
}
