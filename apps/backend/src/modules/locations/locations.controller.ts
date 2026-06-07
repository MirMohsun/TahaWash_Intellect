import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant, type TenantPrincipal } from '../auth/decorators/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationStatusDto } from './dto/update-location-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

@ApiTags('tenant · locations')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a location for the current tenant' })
  async create(@CurrentTenant() actor: TenantPrincipal, @Body() dto: CreateLocationDto) {
    return this.locations.create(actor.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all locations for the current tenant' })
  async list(@CurrentTenant() actor: TenantPrincipal) {
    return this.locations.list(actor.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Location detail' })
  async getById(@Param('id') id: string) {
    return this.locations.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a location' })
  async update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locations.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or disable a location' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateLocationStatusDto) {
    return this.locations.updateStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a location (preserves bay/transaction history)' })
  async softDelete(@Param('id') id: string) {
    return this.locations.softDelete(id);
  }
}
