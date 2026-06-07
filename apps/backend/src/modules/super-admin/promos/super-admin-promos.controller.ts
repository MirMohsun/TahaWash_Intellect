import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminAuthGuard } from '../../auth/guards/super-admin-auth.guard';
import { CreatePromoDto } from './dto/create-promo.dto';
import { ListPromosQueryDto } from './dto/list-promos-query.dto';
import { UpdatePromoStatusDto } from './dto/update-promo-status.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { SuperAdminPromosService } from './super-admin-promos.service';

@ApiTags('super-admin · promos')
@ApiBearerAuth()
@UseGuards(SuperAdminAuthGuard)
@Controller('super-admin/promos')
export class SuperAdminPromosController {
  constructor(private readonly promos: SuperAdminPromosService) {}

  @Post()
  @ApiOperation({ summary: 'Create a promo banner (default status=draft)' })
  async create(@Body() dto: CreatePromoDto) {
    return this.promos.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List promos (paginated, optional status filter)' })
  async list(@Query() query: ListPromosQueryDto) {
    return this.promos.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a promo by id' })
  async getById(@Param('id') id: string) {
    return this.promos.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update promo fields (partial; status via /:id/status)' })
  async update(@Param('id') id: string, @Body() dto: UpdatePromoDto) {
    return this.promos.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change promo status (draft / scheduled / active / expired)' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdatePromoStatusDto) {
    return this.promos.updateStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promo (hard delete)' })
  async delete(@Param('id') id: string) {
    return this.promos.delete(id);
  }
}
