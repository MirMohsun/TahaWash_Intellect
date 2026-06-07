import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { SuperAdminAnalyticsService } from './super-admin-analytics.service';

@ApiTags('super-admin · analytics')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/analytics')
export class SuperAdminAnalyticsController {
  constructor(private readonly analytics: SuperAdminAnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Platform-wide analytics rollup (C6.1)',
    description:
      'Cross-tenant revenue + growth metrics for the given range. Returns ' +
      'total revenue + daily series within range, plus 12-month fixed-window ' +
      'tenant growth + MRR-by-month series, plus top-tenants/top-cities ' +
      'leaderboards. Default range last 90 Baku days, hard cap 365 days.',
  })
  async get(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getAnalytics(query);
  }
}
