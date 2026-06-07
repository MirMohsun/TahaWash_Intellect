import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { UpsertVersionDto } from './dto/upsert-version.dto';
import { SuperAdminVersionService } from './super-admin-version.service';

@ApiTags('super-admin · version')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/version')
export class SuperAdminVersionController {
  constructor(private readonly version: SuperAdminVersionService) {}

  @Get()
  @ApiOperation({
    summary: 'Get force-update config for both platforms (null = not configured)',
  })
  async listAll() {
    return this.version.listAll();
  }

  @Put(':platform')
  @ApiOperation({
    summary: 'Upsert force-update config for ios or android',
    description:
      'Validates minimumVersion <= latestVersion. Apps below minimumVersion are ' +
      'blocked with the force-update modal on launch (mobile reads this from /public/version).',
  })
  async upsert(@Param('platform') platform: string, @Body() dto: UpsertVersionDto) {
    if (platform !== 'ios' && platform !== 'android') {
      throw new BadRequestException({
        code: 'INVALID_PLATFORM',
        message: 'platform must be "ios" or "android"',
      });
    }
    return this.version.upsert(platform, dto);
  }
}
