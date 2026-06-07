import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { AddFeaturedDto } from './dto/add-featured.dto';
import { ReorderFeaturedDto } from './dto/reorder-featured.dto';
import { SuperAdminFeaturedService } from './super-admin-featured.service';

@ApiTags('super-admin · featured')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/featured')
export class SuperAdminFeaturedController {
  constructor(private readonly featured: SuperAdminFeaturedService) {}

  @Get()
  @ApiOperation({ summary: 'List featured tenants (sorted by sortOrder ASC)' })
  async list() {
    return this.featured.list();
  }

  @Post()
  @ApiOperation({
    summary: 'Add (or update sortOrder of) a featured tenant. Tenant must be active.',
  })
  async add(@Body() dto: AddFeaturedDto) {
    return this.featured.add(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Bulk reorder (drag-and-drop). Items must reference active tenants.' })
  async reorder(@Body() dto: ReorderFeaturedDto) {
    return this.featured.reorder(dto);
  }

  @Delete(':tenantId')
  @ApiOperation({ summary: 'Remove a tenant from the featured strip' })
  async remove(@Param('tenantId') tenantId: string) {
    return this.featured.remove(tenantId);
  }
}
