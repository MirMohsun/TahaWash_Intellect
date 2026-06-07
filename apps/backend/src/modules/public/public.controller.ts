import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppVersionQueryDto } from './dto/app-version-query.dto';
import { ListCarwashesQueryDto } from './dto/list-carwashes-query.dto';
import { PublicService } from './public.service';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicSvc: PublicService) {}

  @Get('version')
  @ApiOperation({
    summary: 'Get latest + minimum app version for force-update check',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns version info for the platform.',
  })
  async getVersion(@Query() query: AppVersionQueryDto) {
    return this.publicSvc.getAppVersion(query.platform);
  }

  @Get('carwashes')
  @ApiOperation({
    summary: 'List active carwashes (map data). Optional geo radius filter.',
  })
  async listCarwashes(@Query() query: ListCarwashesQueryDto) {
    return this.publicSvc.listCarwashes({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      centerLat: query.centerLat,
      centerLng: query.centerLng,
      radiusKm: query.radiusKm,
    });
  }

  @Get('carwashes/:id')
  @ApiOperation({ summary: 'Public brand page for a single carwash' })
  async getCarwash(@Param('id') id: string) {
    return this.publicSvc.getCarwashById(id);
  }

  @Get('promos')
  @ApiOperation({
    summary: 'List active promo banners visible on the Main tab',
    description: 'Returns promos with status=active AND startAt<=now<=endAt. Sorted newest-first.',
  })
  async listActivePromos() {
    return this.publicSvc.listActivePromos();
  }

  @Get('featured')
  @ApiOperation({
    summary: 'List featured carwashes for the Main tab spotlight strip',
    description: 'Sorted by sortOrder ASC. Suspended/hidden tenants are filtered server-side.',
  })
  async listFeatured() {
    return this.publicSvc.listFeatured();
  }

  @Get('legal/:type')
  @ApiOperation({
    summary: 'Get currently-published legal document for the requested type + language',
    description:
      'type ∈ {terms, privacy}. language query param ∈ {az, ru, en}. ' +
      '404 if nothing has been published — clients fall back to bundled copy.',
  })
  async getLegalDocument(@Param('type') type: string, @Query('language') language?: string) {
    const lang = language ?? 'en';
    return this.publicSvc.getCurrentLegalDocument(type, lang);
  }

  @Get('devices/:qrShortId')
  @ApiOperation({
    summary: 'QR scan lookup — resolve a printed short id to a wash bay',
    description:
      'Called by the mobile app after a successful QR camera scan. Returns ' +
      'bay + location + tenant info on success; one of UNKNOWN_DEVICE / ' +
      'DEVICE_DELETED / DEVICE_DISABLED / TENANT_SUSPENDED on failure.',
  })
  async getDevice(@Param('qrShortId') qrShortId: string) {
    return this.publicSvc.getDeviceByQrShortId(qrShortId);
  }
}
