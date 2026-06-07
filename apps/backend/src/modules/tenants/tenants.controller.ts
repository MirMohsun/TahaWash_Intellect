import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant, type TenantPrincipal } from '../auth/decorators/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { UpdateTenantSelfDto } from './dto/update-tenant-self.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenant · me')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/me')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my tenant record' })
  async getMe(@CurrentTenant() actor: TenantPrincipal) {
    return this.tenants.getMe(actor.tenantId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my tenant profile (brand, description, min/step config)' })
  async updateMe(@CurrentTenant() actor: TenantPrincipal, @Body() dto: UpdateTenantSelfDto) {
    return this.tenants.updateMe(actor.tenantId, dto);
  }
}
