import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../auth/guards/super-admin-auth.guard';
import { SignAdminUploadDto } from './dto/sign-admin-upload.dto';
import { UploadsService } from './uploads.service';

/**
 * Platform-level uploads for super-admins — currently promo banner images.
 * Separate from the tenant-self controller because promos aren't owned by
 * any tenant, so they can't ride the tenant-scoped signing path.
 */
@ApiTags('super-admin · uploads')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/uploads')
export class SuperAdminUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a one-time PUT URL to upload a promo image directly to R2.' })
  async sign(@Body() dto: SignAdminUploadDto) {
    return this.uploads.signSuperAdminUpload(dto);
  }
}
