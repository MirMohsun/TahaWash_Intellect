import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER_TOKEN, type EmailProvider } from './email.types';
import { MockEmailProvider } from './providers/mock-email.provider';

/**
 * Email module — selects the right provider based on EMAIL_PROVIDER env var.
 *
 * Currently only `mock` is wired; ResendEmailProvider lands when the user
 * provisions a Resend account + DNS records. Adding a provider:
 *   1. Implement EmailProvider in src/modules/email/providers/your-provider.ts
 *   2. Register it in the factory below
 *   3. Add the env enum value in env.schema.ts
 */
@Module({
  providers: [
    MockEmailProvider,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      inject: [ConfigService, MockEmailProvider],
      useFactory: (config: ConfigService<Env, true>, mock: MockEmailProvider): EmailProvider => {
        const provider = config.get('EMAIL_PROVIDER', { infer: true });
        switch (provider) {
          case 'mock':
            return mock;
          case 'resend':
            throw new Error(
              'EMAIL_PROVIDER="resend" not yet implemented. Add a class implementing EmailProvider in src/modules/email/providers/.',
            );
          default:
            throw new Error(`Unknown EMAIL_PROVIDER: ${provider as string}`);
        }
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
