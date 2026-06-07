import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { FinancialsQueryDto } from './dto/financials-query.dto';
import { TenantFinancialsService } from './tenant-financials.service';

@ApiTags('tenant · financials')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/financials')
export class TenantFinancialsController {
  constructor(private readonly financials: TenantFinancialsService) {}

  @Get()
  @ApiOperation({
    summary: 'Tenant financials rollup (totals + daily series + by-location + by-bay)',
    description:
      'Filters: from (YYYY-MM-DD Baku) / to (YYYY-MM-DD Baku). Default range is ' +
      'the last 30 Baku days. Hard cap 365 days. Money sums use Decimal-precise ' +
      'BigInt tetri server-side.',
  })
  async get(@Query() query: FinancialsQueryDto) {
    return this.financials.getFinancials(query);
  }
}
