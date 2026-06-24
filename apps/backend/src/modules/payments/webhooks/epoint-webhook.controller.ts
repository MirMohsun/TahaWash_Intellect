import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PaymentsService } from '../payments.service';

/**
 * ePoint server-to-server callback receiver.
 *
 * PUBLIC + UNAUTHENTICATED — ePoint calls it directly. Trust comes from the
 * signature, verified inside the service with the tenant's private_key.
 *
 * Routed per-merchant: each tenant's ePoint panel callback URL is
 * `https://<backend>/webhooks/epoint/<tenantId>`, so we know which key to
 * verify with. Always replies 200 (handler is idempotent) except on a
 * missing/invalid signature, which yields 400.
 */
@ApiExcludeController()
@Controller('webhooks/epoint')
export class EpointWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':tenantId')
  @HttpCode(HttpStatus.OK)
  async handle(
    @Param('tenantId') tenantId: string,
    @Body('data') data: string,
    @Body('signature') signature: string,
  ): Promise<string> {
    await this.payments.handleEpointCallback(tenantId, data ?? '', signature ?? '');
    return 'OK';
  }
}
