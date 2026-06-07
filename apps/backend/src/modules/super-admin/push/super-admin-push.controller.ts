import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { CreatePushDto } from './dto/create-push.dto';
import { ListPushQueryDto } from './dto/list-push-query.dto';
import { SuperAdminPushService } from './super-admin-push.service';

@ApiTags('super-admin · push')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/push')
export class SuperAdminPushController {
  constructor(private readonly push: SuperAdminPushService) {}

  @Post()
  @ApiOperation({
    summary: 'Compose + enqueue a bulk push notification',
    description:
      'Creates a PushNotification row and enqueues delivery via BullMQ. Set ' +
      'scheduledFor (ISO datetime, future) to defer delivery, or omit for immediate.',
  })
  async create(@Body() dto: CreatePushDto) {
    return this.push.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List push campaign history (paginated, newest first)' })
  async list(@Query() query: ListPushQueryDto) {
    return this.push.list({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('cities')
  @ApiOperation({
    summary: 'Distinct customer cities (for push targeting multi-select)',
    description:
      'Returns the set of non-null Customer.city values across the platform, ' +
      'each with a customer count. Sorted by count desc. Used by the push composer ' +
      'to populate the "By city" target picker.',
  })
  async cities() {
    return this.push.listCities();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a push campaign by id (status + counts)' })
  async getById(@Param('id') id: string) {
    return this.push.getById(id);
  }
}
