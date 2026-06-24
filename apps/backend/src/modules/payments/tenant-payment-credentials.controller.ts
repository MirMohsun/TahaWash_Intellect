import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant, type TenantPrincipal } from '../auth/decorators/current-tenant.decorator';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { SetPaymentCredentialsDto } from './dto/set-payment-credentials.dto';
import { PaymentsService } from './payments.service';

/**
 * Tenant-admin: manage this carwash's ePoint merchant credentials.
 *
 * The private key is encrypted at rest and never returned — GET only reports
 * whether credentials are configured + the public merchant id.
 */
@ApiTags('tenant · payment credentials')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('tenant/payment-credentials')
export class TenantPaymentCredentialsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my ePoint credential status (never returns the secret)' })
  async status(@CurrentTenant() actor: TenantPrincipal) {
    return this.payments.getCredentialStatus(actor.tenantId);
  }

  @Put()
  @ApiOperation({ summary: 'Set my ePoint credentials (private key stored encrypted)' })
  async set(@CurrentTenant() actor: TenantPrincipal, @Body() dto: SetPaymentCredentialsDto) {
    return this.payments.setCredentials(actor.tenantId, dto.merchantId, dto.privateKey);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove my ePoint credentials' })
  async clear(@CurrentTenant() actor: TenantPrincipal) {
    return this.payments.clearCredentials(actor.tenantId);
  }
}
