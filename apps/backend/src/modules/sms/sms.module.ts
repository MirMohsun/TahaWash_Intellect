import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { SmsService } from './sms.service';
import { SMS_PROVIDER_TOKEN, type SmsProvider } from './sms.types';

/**
 * SMS module — selects the right provider based on SMS_PROVIDER env var.
 *
 * Currently only `mock` is wired; real AZ providers (Albatros, Lifecell, etc.)
 * will be added when one is contracted. Adding a provider:
 *   1. Implement SmsProvider in src/modules/sms/providers/your-provider.ts
 *   2. Register it in the factory below
 *   3. Add the env enum value in env.schema.ts
 */
@Module({
  providers: [
    MockSmsProvider,
    {
      provide: SMS_PROVIDER_TOKEN,
      inject: [ConfigService, MockSmsProvider],
      useFactory: (config: ConfigService<Env, true>, mock: MockSmsProvider): SmsProvider => {
        const provider = config.get('SMS_PROVIDER', { infer: true });
        switch (provider) {
          case 'mock':
            return mock;
          case 'albatros':
          case 'lifecell':
            throw new Error(
              `SMS provider "${provider}" not yet implemented. Add a class implementing SmsProvider in src/modules/sms/providers/.`,
            );
          default:
            throw new Error(`Unknown SMS_PROVIDER: ${provider as string}`);
        }
      },
    },
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
