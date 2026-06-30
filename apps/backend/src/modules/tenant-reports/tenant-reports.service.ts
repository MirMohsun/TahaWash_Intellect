import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { HardwareService } from '../hardware/hardware.service';
import { SnapshotCoordinator } from '../hardware/snapshot-coordinator.service';
import type { RawPicoEvent } from '../hardware/dto/mqtt-events.dto';
import { PrismaService } from '../prisma/prisma.service';
import { aggregateTotals, type NormalizedEvent } from './report-aggregation';

interface EventDto {
  eventType: string;
  amountAzn: string | null;
  pulses: number | null;
  txId: string | null;
  programName: string | null;
  durationSeconds: number | null;
  relayCombo: string[];
  rawTs: string;
}

@Injectable()
export class TenantReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hardware: HardwareService,
    private readonly snapshots: SnapshotCoordinator,
  ) {}

  /**
   * Отчёт из БД (HardwareEvent) за диапазон дат [from..to] (включительно).
   *  - bayId задан  → срез по боксу: итоги + полный список событий;
   *  - bayId нет     → срез по тенанту: итоги + разбивка по боксам (без списка).
   * reportDate хранится как "YYYY-MM-DD", поэтому лексикографическое сравнение
   * gte/lte корректно работает как сравнение дат.
   */
  async getReport(from: string, to: string, bayId?: string) {
    const dateRange = { gte: from, lte: to };

    if (bayId) {
      const bay = await this.prisma.scoped.bay.findUnique({
        where: { id: bayId },
        select: { id: true, name: true, location: { select: { name: true } } },
      });
      if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });

      const events = await this.prisma.scoped.hardwareEvent.findMany({
        where: { bayId, reportDate: dateRange },
        orderBy: [{ reportDate: 'asc' }, { rawTs: 'asc' }],
      });

      return {
        from,
        to,
        scope: 'bay' as const,
        bay: { id: bay.id, name: bay.name, locationName: bay.location.name },
        totals: aggregateTotals(events.map(dbToNorm)),
        events: events.map(dbToEventDto),
      };
    }

    // Tenant scope: все события тенанта за диапазон + разбивка по боксам.
    const events = await this.prisma.scoped.hardwareEvent.findMany({
      where: { reportDate: dateRange },
      select: { eventType: true, amountAzn: true, programName: true, bayId: true },
    });
    const bays = await this.prisma.scoped.bay.findMany({
      select: { id: true, name: true, location: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const byBayEvents = new Map<string, NormalizedEvent[]>();
    for (const e of events) {
      const list = byBayEvents.get(e.bayId) ?? [];
      list.push(dbToNorm(e));
      byBayEvents.set(e.bayId, list);
    }

    const byBay = bays
      .map((b) => {
        const t = aggregateTotals(byBayEvents.get(b.id) ?? []);
        return {
          bayId: b.id,
          bayName: b.name,
          locationName: b.location.name,
          revenueAzn: t.revenueAzn,
          eventCount: t.eventCount,
        };
      })
      .sort((a, b) => Number(b.revenueAzn) - Number(a.revenueAzn));

    return {
      from,
      to,
      scope: 'tenant' as const,
      totals: aggregateTotals(events.map(dbToNorm)),
      byBay,
    };
  }

  /**
   * Текущий срез «по кнопке»: запрашивает у Pico get_report и СИНХРОННО ждёт
   * report_snapshot (через SnapshotCoordinator). Возвращает агрегат + список.
   * Бросает RequestTimeoutException(SNAPSHOT_TIMEOUT), если Pico не ответил.
   */
  async requestCurrentSnapshot(bayId: string) {
    const bay = await this.prisma.scoped.bay.findUnique({
      where: { id: bayId },
      select: { hardwareIdentifier: true, name: true, location: { select: { name: true } } },
    });
    if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });
    if (!bay.hardwareIdentifier) throw new NotFoundException({ code: 'BAY_NO_HARDWARE_ID' });

    const requestId = randomUUID();
    const wait = this.snapshots.waitFor(requestId);
    await this.hardware.publish(bay.hardwareIdentifier, { type: 'get_report', requestId });
    const raw = await wait;

    const events = raw.map(rawToEventDto).sort((a, b) => a.rawTs.localeCompare(b.rawTs));
    return {
      capturedAt: new Date().toISOString(),
      bay: { id: bayId, name: bay.name, locationName: bay.location.name },
      totals: aggregateTotals(raw.map(rawToNorm)),
      events,
    };
  }
}

// ── Мапперы ──────────────────────────────────────────────────────────────────

function dbToNorm(e: {
  eventType: string;
  amountAzn: { toString(): string } | null;
  programName: string | null;
}): NormalizedEvent {
  return {
    eventType: e.eventType,
    amountAzn: e.amountAzn == null ? null : Number(e.amountAzn),
    programName: e.programName,
  };
}

function dbToEventDto(e: {
  eventType: string;
  amountAzn: { toString(): string } | null;
  pulses: number | null;
  txId: string | null;
  programName: string | null;
  durationSeconds: number | null;
  relayCombo: string[];
  rawTs: string;
}): EventDto {
  return {
    eventType: e.eventType,
    amountAzn: e.amountAzn?.toString() ?? null,
    pulses: e.pulses,
    txId: e.txId,
    programName: e.programName,
    durationSeconds: e.durationSeconds,
    relayCombo: e.relayCombo,
    rawTs: e.rawTs,
  };
}

function rawToNorm(ev: RawPicoEvent): NormalizedEvent {
  return {
    eventType: ev.type,
    amountAzn: ev.amount ?? null,
    programName: ev.programName ?? ev.program ?? null,
  };
}

function rawToEventDto(ev: RawPicoEvent): EventDto {
  return {
    eventType: ev.type,
    amountAzn: ev.amount?.toString() ?? null,
    pulses: ev.pulses ?? null,
    txId: ev.txId ?? null,
    programName: ev.programName ?? ev.program ?? null,
    durationSeconds: ev.durationS ?? null,
    relayCombo: ev.combo ?? [],
    rawTs: ev.ts,
  };
}
