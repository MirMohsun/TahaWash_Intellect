import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { HardwareAdminService } from './hardware-admin.service';

class RelayControlDto {
  @IsString()
  pin!: string;

  @IsEnum(['on', 'off'])
  action!: 'on' | 'off';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3600)
  duration?: number;
}

class HardwareEventsQueryDto {
  @IsString()
  date!: string; // YYYY-MM-DD
}

@ApiTags('tenant · hardware')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/bays/:bayId/hardware')
export class HardwareAdminController {
  constructor(private readonly svc: HardwareAdminService) {}

  @Get('status')
  @ApiOperation({ summary: 'Онлайн-статус железа: lastSeenAt, relay states' })
  async getStatus(@Param('bayId') bayId: string) {
    return this.svc.getBayHardwareStatus(bayId);
  }

  @Post('relay')
  @ApiOperation({ summary: 'Прямое управление реле Pico (fn2..fn6, pause)' })
  async controlRelay(@Param('bayId') bayId: string, @Body() dto: RelayControlDto) {
    await this.svc.controlRelay(bayId, dto.pin, dto.action, dto.duration);
    return { ok: true };
  }

  @Post('snapshot')
  @ApiOperation({ summary: 'Запросить у Pico снапшот событий текущего дня' })
  async requestSnapshot(@Param('bayId') bayId: string) {
    await this.svc.requestSnapshot(bayId);
    return { ok: true };
  }

  @Get('events')
  @ApiOperation({ summary: 'Список событий HardwareEvent за дату (YYYY-MM-DD)' })
  async getEvents(@Param('bayId') bayId: string, @Query() query: HardwareEventsQueryDto) {
    return this.svc.getHardwareEvents(bayId, query.date);
  }
}
