import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { MockPushProvider } from './providers/mock-push.provider';
import { PushService } from './push.service';
import { PUSH_PROVIDER_TOKEN, type PushProvider } from './push.types';

/**
 * Push module — selects the right provider based on PUSH_PROVIDER env var.
 *
 * `mock` (console only) and `expo` (real delivery via Expo's Push API) are
 * wired. Adding another provider:
 *   1. Implement PushProvider in src/modules/push/providers/your-provider.ts
 *   2. Register it in the factory below
 *   3. Add the env enum value in env.schema.ts
 */
@Module({
  providers: [
    MockPushProvider,
    ExpoPushProvider,
    {
      provide: PUSH_PROVIDER_TOKEN,
      inject: [ConfigService, MockPushProvider, ExpoPushProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockPushProvider,
        expo: ExpoPushProvider,
      ): PushProvider => {
        const provider = config.get('PUSH_PROVIDER', { infer: true });
        switch (provider) {
          case 'mock':
            return mock;
          case 'expo':
            return expo;
          case 'fcm':
            throw new Error(
              'PUSH_PROVIDER "fcm" (direct Firebase) is not implemented. Use "expo" — the app mints ExponentPushTokens and Expo relays to FCM/APNs.',
            );
          default:
            throw new Error(`Unknown PUSH_PROVIDER: ${provider as string}`);
        }
      },
    },
    PushService,
  ],
  exports: [PushService],
})
export class PushModule {}
