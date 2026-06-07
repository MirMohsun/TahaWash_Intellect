import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { UpdatePlatformSettingsDto } from './dto/update-settings.dto';
import { SuperAdminSettingsService } from './super-admin-settings.service';

@ApiTags('super-admin · settings')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/settings')
export class SuperAdminSettingsController {
  constructor(private readonly settings: SuperAdminSettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all platform settings as a key-value map',
    description:
      'Returns the current value for each known platform setting key. Keys ' +
      'the admin has not set yet are simply absent from the map (client should ' +
      'treat them as empty strings).',
  })
  async getAll() {
    return this.settings.getAll();
  }

  @Patch()
  @ApiOperation({
    summary: 'Update one or more platform settings (diff-only)',
    description:
      'Accepts a list of { key, value } items. Empty value clears the setting ' +
      '(row deleted). Unknown keys are rejected with 400 UNKNOWN_SETTING_KEY.',
  })
  async update(@Body() dto: UpdatePlatformSettingsDto) {
    return this.settings.update(dto);
  }
}
