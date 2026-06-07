import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import type { Env } from '../../config/env.schema';

/**
 * Custom Terminus health indicator that pings Redis.
 *
 * Used by /health/ready to confirm the BullMQ broker is reachable. We
 * lazily open a short-lived ioredis connection per check rather than
 * holding a long-lived one — BullMQ owns its own connection pool, and we
 * don't want this probe contending with workers.
 *
 * `ioredis` is a transitive dep of `bullmq`, so we don't add it directly.
 */
@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly indicator: HealthIndicatorService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    const url = this.config.get('REDIS_URL', { infer: true });
    let client: Redis | undefined;
    try {
      client = new Redis(url, {
        connectTimeout: 3_000,
        maxRetriesPerRequest: 0,
        lazyConnect: true,
      });
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG') {
        return check.down({ message: `Unexpected ping reply: ${pong}` });
      }
      return check.up();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Redis unreachable';
      this.logger.warn(`Redis health check failed: ${message}`);
      return check.down({ message });
    } finally {
      // ioredis emits an unhandled error if disconnected before connect
      // completes — silence by attaching a no-op handler first.
      client?.on('error', () => undefined);
      client?.disconnect();
    }
  }
}
