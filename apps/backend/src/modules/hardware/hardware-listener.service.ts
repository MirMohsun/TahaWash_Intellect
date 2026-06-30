import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AckEvent,
  CashEvent,
  DailyReportEvent,
  HeartbeatEvent,
  MqttStatusEvent,
  OfflineEvent,
  RawPicoEvent,
  ReportSnapshotEvent,
} from './dto/mqtt-events.dto';
import { HardwareService } from './hardware.service';
import { SnapshotCoordinator } from './snapshot-coordinator.service';

/**
 * Обрабатывает входящие MQTT-события от Pico и обновляет базу данных.
 *
 * Таблица обработчиков:
 *   ack           → Transaction: paid_crediting → paid_credited / paid_hardware_error
 *   payment_event → HardwareEvent (cash)
 *   heartbeat     → Bay.lastSeenAt + Bay.lastRelayState
 *   daily_report  → HardwareEvent[] за дату + report_ack
 *   report_snapshot → лог (не сохраняем в БД, только debug)
 */
@Injectable()
export class HardwareListenerService implements OnModuleInit {
  private readonly logger = new Logger(HardwareListenerService.name);

  constructor(
    private readonly hardware: HardwareService,
    private readonly prisma: PrismaService,
    private readonly snapshots: SnapshotCoordinator,
  ) {}

  onModuleInit() {
    this.hardware.onStatus((hardwareId, event) => {
      void this.dispatch(hardwareId, event);
    });
  }

  private async dispatch(hardwareId: string, event: MqttStatusEvent): Promise<void> {
    switch (event.type) {
      case 'ack':
        await this.handleAck(event);
        break;
      case 'payment_event':
        await this.handleCash(hardwareId, event);
        break;
      case 'heartbeat':
        await this.handleHeartbeat(hardwareId, event);
        break;
      case 'daily_report':
        await this.handleDailyReport(hardwareId, event);
        break;
      case 'report_snapshot':
        this.handleSnapshot(hardwareId, event);
        break;
      case 'offline':
        await this.handleOffline(hardwareId, event);
        break;
    }
  }

  // ── ACK ──────────────────────────────────────────────────────────────────

  private async handleAck(event: AckEvent): Promise<void> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: event.txId },
      select: { id: true, status: true },
    });
    if (!tx) {
      this.logger.warn(`ACK for unknown txId=${event.txId}`);
      return;
    }
    if (tx.status !== 'paid_crediting') {
      this.logger.warn(`ACK for txId=${event.txId} in unexpected status=${tx.status} — ignored`);
      return;
    }

    if (event.credited) {
      await this.prisma.transaction.update({
        where: { id: event.txId },
        data: {
          status: 'paid_credited',
          hardwareCreditedAt: new Date(),
        },
      });
      this.logger.log(`Transaction ${event.txId} → paid_credited`);
    } else {
      await this.prisma.transaction.update({
        where: { id: event.txId },
        data: {
          status: 'paid_hardware_error',
          errorReason: event.error ?? 'hardware_ack_failed',
        },
      });
      this.logger.warn(
        `Transaction ${event.txId} → paid_hardware_error: ${event.error ?? 'unknown'}`,
      );
    }
  }

  // ── Cash (купюроприёмник) ────────────────────────────────────────────────

  private async handleCash(hardwareId: string, event: CashEvent): Promise<void> {
    const bay = await this.findBayByHardwareId(hardwareId);
    if (!bay) return;

    await this.prisma.hardwareEvent.create({
      data: {
        bayId: bay.id,
        tenantId: bay.tenantId,
        eventType: 'cash',
        amountAzn: event.amount,
        reportDate: event.ts.slice(0, 10),
        rawTs: event.ts,
      },
    });
    this.logger.log(`Cash event: hardwareId=${hardwareId} amount=${event.amount} AZN`);
  }

  // ── Heartbeat ────────────────────────────────────────────────────────────

  private async handleHeartbeat(hardwareId: string, event: HeartbeatEvent): Promise<void> {
    const bay = await this.findBayByHardwareId(hardwareId);
    if (!bay) return;

    await this.prisma.bay.update({
      where: { id: bay.id },
      data: {
        lastSeenAt: new Date(),
        lastRelayState: event.relays as object,
      },
    });
    this.logger.debug(`Heartbeat: hardwareId=${hardwareId} uptime=${event.uptime}s`);
  }

  // ── Offline (LWT) ──────────────────────────────────────────────────────────

  /**
   * Брокер прислал Last Will — устройство пропало (питание/Wi-Fi). Сбрасываем
   * lastSeenAt в null, чтобы статус сразу стал offline (не дожидаясь протухания
   * по 2-минутному порогу). Следующий heartbeat после реконнекта вернёт online.
   */
  private async handleOffline(hardwareId: string, _event: OfflineEvent): Promise<void> {
    const bay = await this.findBayByHardwareId(hardwareId);
    if (!bay) return;

    await this.prisma.bay.update({
      where: { id: bay.id },
      data: { lastSeenAt: null },
    });
    this.logger.warn(`Hardware OFFLINE (LWT): hardwareId=${hardwareId}`);
  }

  // ── Daily report ─────────────────────────────────────────────────────────

  private async handleDailyReport(hardwareId: string, event: DailyReportEvent): Promise<void> {
    const bay = await this.findBayByHardwareId(hardwareId);
    if (!bay) return;

    // Идемпотентность: первая часть отчёта стирает все ранее сохранённые
    // события этого бокса за эту дату, затем части переинсертятся. Это
    // защищает от дублей при повторной отправке отчёта (ретраи) и от
    // двойного учёта real-time cash-событий, которые тоже входят в отчёт.
    if (event.part === 1) {
      await this.prisma.hardwareEvent.deleteMany({
        where: { bayId: bay.id, reportDate: event.date },
      });
    }

    if (event.events.length > 0) {
      await this.saveRawEvents(bay.id, bay.tenantId, event.date, event.events);
    }

    this.logger.log(
      `Daily report: hardwareId=${hardwareId} date=${event.date} part=${event.part}/${event.totalParts} events=${event.events.length}`,
    );

    // После последнего чанка — отправляем report_ack
    if (event.part === event.totalParts) {
      await this.hardware.publish(hardwareId, { type: 'report_ack', date: event.date });
      this.logger.log(`report_ack sent: hardwareId=${hardwareId} date=${event.date}`);
    }
  }

  // ── Snapshot (только логируем) ───────────────────────────────────────────

  private handleSnapshot(hardwareId: string, event: ReportSnapshotEvent): void {
    this.logger.log(
      `Snapshot: hardwareId=${hardwareId} date=${event.date} ` +
        `part=${event.part ?? 1}/${event.totalParts ?? 1} count=${event.count}`,
    );
    // Синхронный снимок «по кнопке»: отдаём части в координатор по requestId.
    if (event.requestId) {
      this.snapshots.ingest(
        event.requestId,
        event.part ?? 1,
        event.totalParts ?? 1,
        event.events ?? [],
      );
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findBayByHardwareId(hardwareId: string) {
    const bay = await this.prisma.bay.findUnique({
      where: { hardwareIdentifier: hardwareId },
      select: { id: true, tenantId: true },
    });
    if (!bay) {
      this.logger.warn(`No bay with hardwareIdentifier=${hardwareId}`);
    }
    return bay;
  }

  private async saveRawEvents(
    bayId: string,
    tenantId: string,
    reportDate: string,
    rawEvents: RawPicoEvent[],
  ): Promise<void> {
    const data = rawEvents.map((ev) => ({
      bayId,
      tenantId,
      eventType: ev.type,
      amountAzn: ev.amount ?? null,
      pulses: ev.pulses ?? null,
      txId: ev.txId ?? null,
      programName: ev.programName ?? ev.program ?? null,
      durationSeconds: ev.durationS ?? null,
      relayCombo: ev.combo ?? [],
      reportDate,
      rawTs: ev.ts,
    }));

    await this.prisma.hardwareEvent.createMany({ data, skipDuplicates: false });
  }
}
