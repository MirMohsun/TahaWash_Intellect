import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { CredentialCipherService } from './crypto/credential-cipher.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TenantPaymentCredentialsController } from './tenant-payment-credentials.controller';
import { EpointWebhookController } from './webhooks/epoint-webhook.controller';
import { EpointProvider } from './providers/epoint-payment.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER_TOKEN, type PaymentProvider } from './payment.types';

/**
 * Payments module.
 *
 * Selects the active provider from PAYMENT_PROVIDER (`mock` | `epoint`), exposes
 * the customer payment endpoints (PaymentsController → PaymentsService), and
 * exports PaymentsService + the cipher for the webhook controller (next increment).
 */
@Module({
  controllers: [PaymentsController, TenantPaymentCredentialsController, EpointWebhookController],
  providers: [
    PaymentsService,
    CredentialCipherService,
    MockPaymentProvider,
    EpointProvider,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, MockPaymentProvider, EpointProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockPaymentProvider,
        epoint: EpointProvider,
      ): PaymentProvider => {
        const provider = config.get('PAYMENT_PROVIDER', { infer: true });
        switch (provider) {
          case 'mock':
            return mock;
          case 'epoint':
            return epoint;
          default:
            throw new Error(`Unknown PAYMENT_PROVIDER: ${provider as string}`);
        }
      },
    },
  ],
  exports: [PAYMENT_PROVIDER_TOKEN, CredentialCipherService, PaymentsService],
})
export class PaymentsModule {}
