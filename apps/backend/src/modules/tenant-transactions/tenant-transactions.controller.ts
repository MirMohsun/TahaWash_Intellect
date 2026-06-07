import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { ListTenantTransactionsQueryDto } from './dto/list-tenant-transactions-query.dto';
import { TenantTransactionsService } from './tenant-transactions.service';

@ApiTags('tenant · transactions')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/transactions')
export class TenantTransactionsController {
  constructor(private readonly txs: TenantTransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List transactions for the current tenant (paginated + filtered)',
    description:
      'Filters: status / locationId / bayId / from (YYYY-MM-DD Baku) / to (YYYY-MM-DD Baku). ' +
      'Page size capped at 200; default 50. Customer phone is masked.',
  })
  async list(@Query() query: ListTenantTransactionsQueryDto) {
    return this.txs.list(query);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    summary: 'Export filtered transactions as a CSV file',
    description:
      'Same filters as the list endpoint. Hard-capped at 50,000 rows — busy ' +
      'tenants should narrow with date range to export everything they need.',
  })
  async exportCsv(
    @Query() query: ListTenantTransactionsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { csv, filename, capped, rowCount } = await this.txs.exportCsv(query);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Row-Count', String(rowCount));
    res.setHeader('X-Capped', capped ? 'true' : 'false');
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Single transaction detail' })
  async getById(@Param('id') id: string) {
    return this.txs.getById(id);
  }
}
