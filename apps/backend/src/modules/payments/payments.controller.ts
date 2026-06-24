import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentCustomer,
  type CustomerPrincipal,
} from '../auth/decorators/current-customer.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

/**
 * Customer-authenticated payment endpoints.
 *
 * POST /payments              → start a payment for a scanned bay
 * GET  /payments/:id          → poll a transaction's status (after a redirect)
 * POST /payments/:id/mock-complete → [mock only] simulate ePoint completing it
 */
@ApiTags('customer · payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a payment for a scanned bay' })
  async create(@CurrentCustomer() actor: CustomerPrincipal, @Body() dto: CreatePaymentDto) {
    return this.payments.createPayment(actor.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction status (poll after redirect/widget)' })
  async status(@CurrentCustomer() actor: CustomerPrincipal, @Param('id') id: string) {
    return this.payments.getTransactionStatus(actor.id, id);
  }

  @Post(':id/mock-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[mock only] Simulate ePoint completing a redirect payment' })
  async mockComplete(@CurrentCustomer() actor: CustomerPrincipal, @Param('id') id: string) {
    return this.payments.mockComplete(actor.id, id);
  }
}
