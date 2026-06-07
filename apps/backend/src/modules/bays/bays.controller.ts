import { Body, Controller, Get, Header, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentTenant, type TenantPrincipal } from '../auth/decorators/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { BaysService } from './bays.service';
import { CreateBayDto } from './dto/create-bay.dto';
import { UpdateBayDto } from './dto/update-bay.dto';

@ApiTags('tenant · bays')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant')
export class BaysController {
  constructor(private readonly bays: BaysService) {}

  // ─── Bays under a specific location ──────────────────────────

  @Post('locations/:locationId/bays')
  @ApiOperation({ summary: 'Create a bay under a location (auto-generates qrShortId)' })
  async create(
    @CurrentTenant() actor: TenantPrincipal,
    @Param('locationId') locationId: string,
    @Body() dto: CreateBayDto,
  ) {
    return this.bays.create(actor.tenantId, locationId, dto);
  }

  @Get('locations/:locationId/bays')
  @ApiOperation({ summary: 'List bays at a location' })
  async listForLocation(@Param('locationId') locationId: string) {
    return this.bays.listForLocation(locationId);
  }

  // ─── Bays across the whole tenant ────────────────────────────

  @Get('bays')
  @ApiOperation({ summary: 'List all bays for the current tenant (across locations)' })
  async listAll() {
    return this.bays.listAll();
  }

  @Get('bays/:id')
  @ApiOperation({ summary: 'Bay detail (includes its location)' })
  async getById(@Param('id') id: string) {
    return this.bays.getById(id);
  }

  @Patch('bays/:id')
  @ApiOperation({ summary: 'Update a bay (name, hardware identifier, status)' })
  async update(@Param('id') id: string, @Body() dto: UpdateBayDto) {
    return this.bays.update(id, dto);
  }

  @Post('bays/:id/regenerate-qr')
  @ApiOperation({
    summary: "Regenerate this bay's qrShortId. Old printed sticker becomes invalid.",
  })
  async regenerateQr(@Param('id') id: string) {
    return this.bays.regenerateQr(id);
  }

  @Get('bays/:id/qr.pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download a printable A4 QR PDF for this bay' })
  async qrPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { pdf, filename } = await this.bays.renderQrPdf(id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.byteLength));
    res.end(pdf);
  }

  @Get('locations/:locationId/bays/qr.pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({
    summary: 'Download a single PDF with one page per bay at this location',
    description:
      'Bulk-print all QR stickers for a location. One A4 page per bay, ordered ' +
      'by createdAt asc to match the in-app list order.',
  })
  async bulkQrPdfForLocation(
    @Param('locationId') locationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { pdf, filename } = await this.bays.renderBulkLocationQrPdf(locationId);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.byteLength));
    res.end(pdf);
  }
}
