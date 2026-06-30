import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { TenantReportsService } from './tenant-reports.service';

class ReportRangeQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  to!: string;

  @IsOptional()
  @IsString()
  bayId?: string; // задан -> срез по боксу со списком; иначе срез по тенанту
}

@ApiTags('tenant · reports')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/reports')
export class TenantReportsController {
  constructor(private readonly svc: TenantReportsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Отчёт из БД (тенант или бокс) за диапазон дат [from..to]' })
  async daily(@Query() query: ReportRangeQueryDto) {
    return this.svc.getReport(query.from, query.to, query.bayId);
  }

  @Post('bays/:bayId/snapshot')
  @ApiOperation({ summary: 'Текущий срез событий бокса: запрос к Pico + синхронное ожидание' })
  async snapshot(@Param('bayId') bayId: string) {
    return this.svc.requestCurrentSnapshot(bayId);
  }
}
