import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { CreatePhotoDto } from '../uploads/dto/create-photo.dto';
import { PatchPhotoDto } from '../uploads/dto/patch-photo.dto';
import { LocationPhotosService } from './location-photos.service';

/**
 * Location photo gallery — same shape as the tenant gallery but scoped to
 * a single location. Mounted under the location id so ownership is checked
 * against that location (which the service verifies belongs to the tenant).
 *
 * Upload flow (admin): uploadFile('photo', file) → R2 → POST here with the
 * resulting {url}. The bytes ride the existing tenant sign endpoint; only
 * the persistence target (LocationPhoto) is new.
 */
@ApiTags('tenant · location photos')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/locations/:locationId/photos')
export class LocationPhotosController {
  constructor(private readonly photos: LocationPhotosService) {}

  @Get()
  @ApiOperation({ summary: 'List photos for one of my locations (sorted).' })
  async list(@Param('locationId') locationId: string) {
    return this.photos.list(locationId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a photo URL to one of my locations.' })
  async create(@Param('locationId') locationId: string, @Body() dto: CreatePhotoDto) {
    return this.photos.create(locationId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sortOrder or hero flag on a location photo.' })
  async patch(
    @Param('locationId') locationId: string,
    @Param('id') id: string,
    @Body() dto: PatchPhotoDto,
  ) {
    return this.photos.patch(locationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a location photo (also removes the R2 object).' })
  async delete(
    @Param('locationId') locationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.photos.delete(locationId, id);
  }
}
