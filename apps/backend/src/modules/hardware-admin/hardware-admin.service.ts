import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HardwareService } from '../hardware/hardware.service';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 минуты

@Injectable()
export class HardwareAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hardware: HardwareService,
  ) {}

  async getBayHardwareStatus(bayId: string) {
    const bay = await this.prisma.scoped.bay.findUnique({
      where: { id: bayId },
      select: {
        id: true,
        hardwareIdentifier: true,
        lastSeenAt: true,
        lastRelayState: true,
      },
    });
    if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });

    const online =
      bay.lastSeenAt !== null &&
      Date.now() - bay.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;

    return {
      hardwareIdentifier: bay.hardwareIdentifier,
      online,
      lastSeenAt: bay.lastSeenAt?.toISOString() ?? null,
      relays: (bay.lastRelayState as Record<string, number>) ?? null,
    };
  }

  async controlRelay(
    bayId: string,
    pin: string,
    action: 'on' | 'off',
    duration?: number,
  ): Promise<void> {
    const bay = await this.prisma.scoped.bay.findUnique({
      where: { id: bayId },
      select: { hardwareIdentifier: true },
    });
    if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });
    if (!bay.hardwareIdentifier) {
      throw new NotFoundException({ code: 'BAY_NO_HARDWARE_ID' });
    }

    await this.hardware.publish(bay.hardwareIdentifier, {
      type: 'relay',
      pin,
      action,
      duration,
    });
  }

  async requestSnapshot(bayId: string): Promise<void> {
    const bay = await this.prisma.scoped.bay.findUnique({
      where: { id: bayId },
      select: { hardwareIdentifier: true },
    });
    if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });
    if (!bay.hardwareIdentifier) {
      throw new NotFoundException({ code: 'BAY_NO_HARDWARE_ID' });
    }

    await this.hardware.publish(bay.hardwareIdentifier, { type: 'get_report' });
  }

  async getHardwareEvents(bayId: string, date: string) {
    const bay = await this.prisma.scoped.bay.findUnique({
      where: { id: bayId },
      select: { id: true },
    });
    if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });

    const events = await this.prisma.scoped.hardwareEvent.findMany({
      where: { bayId, reportDate: date },
      orderBy: { rawTs: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      amountAzn: e.amountAzn?.toString() ?? null,
      pulses: e.pulses,
      txId: e.txId,
      programName: e.programName,
      durationSeconds: e.durationSeconds,
      relayCombo: e.relayCombo,
      reportDate: e.reportDate,
      rawTs: e.rawTs,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}
