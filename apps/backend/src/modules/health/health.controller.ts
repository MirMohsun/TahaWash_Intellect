import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  /**
   * Liveness probe — process is up.
   * Used by load balancers / Railway to know the container is alive.
   */
  @Get('health')
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  /**
   * Readiness probe — app is up AND dependencies are reachable.
   * Used to decide whether to route traffic to this instance.
   */
  @Get('health/ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database'),
      () => this.redisHealth.pingCheck('redis'),
    ]);
  }
}
