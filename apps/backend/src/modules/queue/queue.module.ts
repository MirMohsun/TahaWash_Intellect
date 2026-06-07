import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';

/**
 * BullMQ root configuration.
 *
 * Provides the shared Redis connection used by every queue in the app.
 * Individual queues are registered (and processors attached) inside the
 * feature module that owns them — see jobs.module.ts.
 *
 * No producers are wired here yet because the cron-driven Phase 1.8 work
 * does not need a queue. Push delivery (Phase 1.10) and email send
 * (Phase 1.9) will register their queues against this same root.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const redisUrl = new URL(config.get('REDIS_URL', { infer: true }));
        const useTls = redisUrl.protocol === 'rediss:';
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            password: redisUrl.password || undefined,
            username: redisUrl.username || undefined,
            // Dual-stack DNS lookup. REQUIRED on Railway: its Redis lives at an
            // IPv6-only `*.railway.internal` host, and ioredis defaults to IPv4
            // (family 4) — so without this it never connects and queue.add()
            // throws, surfacing as a 500 when sending a push.
            family: 0,
            // TLS when the URL is rediss:// (managed/Upstash-style Redis).
            ...(useTls ? { tls: {} } : {}),
            // ioredis option name — BullMQ's BackoffOptions live in defaultJobOptions below.
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: { count: 1_000 },
            removeOnFail: { count: 5_000 },
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
