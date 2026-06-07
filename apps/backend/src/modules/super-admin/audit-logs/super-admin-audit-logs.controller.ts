import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

@ApiTags('super-admin · audit-logs')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/audit-logs')
export class SuperAdminAuditLogsController {
  constructor(private readonly logs: SuperAdminAuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Query audit logs',
    description:
      'Filter by actorType, actorId, action (prefix), resourceType, resourceId, and date range. ' +
      'Always returned newest first.',
  })
  async list(@Query() query: ListAuditLogsQueryDto) {
    return this.logs.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit log row' })
  async getById(@Param('id') id: string) {
    return this.logs.getById(id);
  }
}
