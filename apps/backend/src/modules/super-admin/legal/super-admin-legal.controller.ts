import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentSuperAdmin,
  type SuperAdminPrincipal,
} from '../../auth/decorators/current-super-admin.decorator';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { PublishLegalDocumentDto } from './dto/publish-legal-document.dto';
import { SuperAdminLegalService } from './super-admin-legal.service';

@ApiTags('super-admin · legal')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/legal')
export class SuperAdminLegalController {
  constructor(private readonly legal: SuperAdminLegalService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get the currently-published version per (type, language)',
    description:
      'Returns { terms: { az, ru, en }, privacy: { az, ru, en } } with each slot ' +
      'set to the current row or `null` if nothing has been published yet.',
  })
  async getCurrent() {
    return this.legal.getCurrentMap();
  }

  @Get(':type/:language')
  @ApiOperation({
    summary: 'List every published version for one (type, language) — newest first',
  })
  @ApiResponse({ status: 400, description: 'Unknown type or language.' })
  async listVersions(@Param('type') type: string, @Param('language') language: string) {
    return this.legal.listVersions(type, language);
  }

  @Post(':type/:language')
  @ApiOperation({
    summary: 'Publish a new version of (type, language)',
    description:
      'Auto-increments version per (type, language). Flips any previously ' +
      'current row to isCurrent=false in the same transaction. Writes an ' +
      'audit-log row (super_admin · legal_document.publish).',
  })
  @ApiResponse({ status: 201, description: 'Version published; now isCurrent=true.' })
  @ApiResponse({ status: 400, description: 'Invalid type/language or empty sections.' })
  async publish(
    @Param('type') type: string,
    @Param('language') language: string,
    @Body() dto: PublishLegalDocumentDto,
    @CurrentSuperAdmin() admin: SuperAdminPrincipal,
  ) {
    return this.legal.publish(type, language, dto, admin.id);
  }

  @Post(':id/make-current')
  @ApiOperation({
    summary: 'Restore an older version as the current one (rollback)',
    description:
      'Flips the target row to isCurrent=true and the previous current row to ' +
      'isCurrent=false. No new version is created — pointer-flip only. Writes ' +
      'an audit-log row (super_admin · legal_document.restore).',
  })
  @ApiResponse({ status: 200, description: 'Row is now current.' })
  @ApiResponse({ status: 404, description: 'Legal document not found.' })
  async makeCurrent(@Param('id') id: string, @CurrentSuperAdmin() admin: SuperAdminPrincipal) {
    return this.legal.makeCurrent(id, admin.id);
  }
}
