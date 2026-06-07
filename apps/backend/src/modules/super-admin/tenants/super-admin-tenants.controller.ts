import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants.query';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SuperAdminTenantsService } from './super-admin-tenants.service';

@ApiTags('super-admin · tenants')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/tenants')
export class SuperAdminTenantsController {
  constructor(private readonly tenants: SuperAdminTenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant (returns generated password ONCE)' })
  @ApiResponse({ status: 201, description: 'Tenant + tenant user created' })
  @ApiResponse({ status: 409, description: 'VOEN or username already taken' })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tenants (paginated, searchable, filterable)' })
  async list(@Query() query: ListTenantsQueryDto) {
    return this.tenants.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tenant by id (includes user + counts)' })
  async getById(@Param('id') id: string) {
    return this.tenants.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant fields (partial)' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change tenant status (pending / active / suspended / hidden)' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.tenants.updateStatus(id, dto);
  }
}
