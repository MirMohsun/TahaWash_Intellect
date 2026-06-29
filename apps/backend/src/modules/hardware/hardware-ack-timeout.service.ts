import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Env } from '../../config/env.schema';
import { RequestContext } from '../../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cron-задача: каждые 10 секунд проверяет транзакции в статусе paid_crediting.
 *
 * Если с момента последнего обновления прошло больше HARDWARE_ACK_TIMEOUT_S
 * секунд — банк одобрил, но Pico не прислал ACK — переводим в
 * paid_hardware_error.
 *
 * Реальный возврат средств через ePoint будет добавлен в Phase 2.8.
 */
@Injectable()
export class HardwareAckTimeoutService {
  private readonly logger = new Logger(HardwareAckTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron('*/10 * * * * *', { name: 'hardware-ack-timeout' })
  async checkTimeouts(): Promise<void> {
    const timeoutS = this.config.get('HARDWARE_ACK_TIMEOUT_S', { infer: true });
    const cutoff = new Date(Date.now() - timeoutS * 1000);

    await RequestContext.withBypass(async () => {
      const stale = await this.prisma.transaction.findMany({
        where: {
          status: 'paid_crediting',
          updatedAt: { lt: cutoff },
        },
        select: { id: true, bayId: true, amountAzn: true },
      });

      if (stale.length === 0) return;

      this.logger.warn(`Hardware ACK timeout: ${stale.length} transaction(s) exceeding ${timeoutS}s`);

      for (const tx of stale) {
        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: {
            status: 'paid_hardware_error',
            errorReason: `hardware_ack_timeout_${timeoutS}s`,
          },
        });
        this.logger.warn(
          `Transaction ${tx.id} → paid_hardware_error (ACK timeout, bay=${tx.bayId})`,
        );
        // TODO Phase 2.8: инициировать refund через ePoint API
      }
    });
  }
}
