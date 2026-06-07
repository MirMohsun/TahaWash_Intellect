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
import { CurrentTenant, type TenantPrincipal } from '../auth/decorators/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { PatchPhotoDto } from './dto/patch-photo.dto';
import { SignUploadDto } from './dto/sign-upload.dto';
import { TenantPhotosService } from './tenant-photos.service';
import { UploadsService } from './uploads.service';

/**
 * Tenant-self uploads + gallery — mounted at /tenant/me to sit next to
 * the existing tenant self endpoints. TenantAuthGuard ensures the JWT
 * belongs to a tenant user; the @CurrentTenant() decorator hands us the
 * tenant id we scope everything to.
 *
 * Three areas:
 *   - POST /tenant/me/uploads/sign — sign one PUT URL for direct R2 upload.
 *   - GET/POST/PATCH/DELETE /tenant/me/photos — gallery CRUD on TenantPhoto.
 */
@ApiTags('tenant · uploads & photos')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/me')
export class TenantUploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly photos: TenantPhotosService,
  ) {}

  // ─── Uploads ─────────────────────────────────────────────────

  @Post('uploads/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a one-time PUT URL to upload a logo / photo directly to R2.',
  })
  async sign(@CurrentTenant() actor: TenantPrincipal, @Body() dto: SignUploadDto) {
    return this.uploads.signTenantUpload(actor.tenantId, dto);
  }

  // ─── Photos gallery ──────────────────────────────────────────

  @Get('photos')
  @ApiOperation({ summary: 'List my tenant gallery photos (sorted).' })
  async list(@CurrentTenant() actor: TenantPrincipal) {
    return this.photos.list(actor.tenantId);
  }

  @Post('photos')
  @ApiOperation({ summary: 'Add a photo URL to my tenant gallery.' })
  async create(@CurrentTenant() actor: TenantPrincipal, @Body() dto: CreatePhotoDto) {
    return this.photos.create(actor.tenantId, dto);
  }

  @Patch('photos/:id')
  @ApiOperation({ summary: 'Update sortOrder or hero flag on one of my photos.' })
  async patch(
    @CurrentTenant() actor: TenantPrincipal,
    @Param('id') id: string,
    @Body() dto: PatchPhotoDto,
  ) {
    return this.photos.patch(actor.tenantId, id, dto);
  }

  @Delete('photos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of my gallery photos (also removes the R2 object).' })
  async delete(@CurrentTenant() actor: TenantPrincipal, @Param('id') id: string): Promise<void> {
    await this.photos.delete(actor.tenantId, id);
  }
}
