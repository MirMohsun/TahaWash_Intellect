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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentCustomer,
  type CustomerPrincipal,
} from '../auth/decorators/current-customer.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomersService } from './customers.service';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { UpdateMeDto } from './dto/update-me.dto';

/**
 * Customer-authenticated endpoints. The base path is `/me` because every
 * route here returns or mutates data belonging to the calling customer.
 */
@ApiTags('customer · me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // ─── Profile ───────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get my customer profile' })
  async getMe(@CurrentCustomer() actor: CustomerPrincipal) {
    return this.customers.getMe(actor.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my profile (name, language, push token)' })
  async updateMe(@CurrentCustomer() actor: CustomerPrincipal, @Body() dto: UpdateMeDto) {
    return this.customers.updateMe(actor.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete my account (soft-delete + anonymize transactions)',
  })
  async deleteMe(@CurrentCustomer() actor: CustomerPrincipal) {
    return this.customers.deleteMe(actor.id);
  }

  // ─── Favorites ─────────────────────────────────────────────────

  @Get('favorites')
  @ApiOperation({ summary: 'List my favorite carwashes' })
  async listFavorites(@CurrentCustomer() actor: CustomerPrincipal) {
    return this.customers.listFavorites(actor.id);
  }

  @Post('favorites/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a carwash to my favorites' })
  async addFavorite(
    @CurrentCustomer() actor: CustomerPrincipal,
    @Param('tenantId') tenantId: string,
  ) {
    return this.customers.addFavorite(actor.id, tenantId);
  }

  @Delete('favorites/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a carwash from my favorites' })
  async removeFavorite(
    @CurrentCustomer() actor: CustomerPrincipal,
    @Param('tenantId') tenantId: string,
  ) {
    return this.customers.removeFavorite(actor.id, tenantId);
  }

  // ─── Transactions ──────────────────────────────────────────────

  @Get('transactions')
  @ApiOperation({ summary: 'List my wash history (paginated, newest first)' })
  async listTransactions(
    @CurrentCustomer() _actor: CustomerPrincipal,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.customers.listMyTransactions({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get one of my transactions in detail' })
  async getTransaction(@CurrentCustomer() _actor: CustomerPrincipal, @Param('id') id: string) {
    return this.customers.getMyTransaction(id);
  }

  // ─── Payment methods (saved cards) ─────────────────────────────

  @Get('payment-methods')
  @ApiOperation({ summary: 'List my saved cards' })
  async listPaymentMethods(@CurrentCustomer() actor: CustomerPrincipal) {
    return this.customers.listMyPaymentMethods(actor.id);
  }

  @Delete('payment-methods/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete one of my saved cards' })
  async deletePaymentMethod(@CurrentCustomer() actor: CustomerPrincipal, @Param('id') id: string) {
    return this.customers.deleteMyPaymentMethod(actor.id, id);
  }

  // ─── Notifications (in-app inbox) ───────────────────────────────

  @Get('notifications')
  @ApiOperation({ summary: 'List my in-app notifications (newest first) + unread count' })
  async listNotifications(@CurrentCustomer() actor: CustomerPrincipal) {
    return this.customers.listMyNotifications(actor.id);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async readAllNotifications(@CurrentCustomer() actor: CustomerPrincipal) {
    return this.customers.markAllNotificationsRead(actor.id);
  }
}
