import { Injectable, Logger, RequestTimeoutException } from '@nestjs/common';
import type { RawPicoEvent } from './dto/mqtt-events.dto';

interface Pending {
  events: RawPicoEvent[];
  received: number; // сколько частей пришло
  resolve: (events: RawPicoEvent[]) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Координирует синхронный запрос «текущего среза» у Pico.
 *
 * Поток: hardware-admin генерит requestId, вызывает waitFor() и публикует
 * get_report{requestId}. Pico отвечает report_snapshot частями (part/totalParts)
 * с тем же requestId — листенер скармливает их сюда через ingest(). Когда
 * собраны все части, промис из waitFor() резолвится со всеми событиями.
 * Если Pico не ответил за timeoutMs — промис реджектится (SNAPSHOT_TIMEOUT).
 */
@Injectable()
export class SnapshotCoordinator {
  private readonly logger = new Logger(SnapshotCoordinator.name);
  private readonly pending = new Map<string, Pending>();

  waitFor(requestId: string, timeoutMs = 6000): Promise<RawPicoEvent[]> {
    return new Promise<RawPicoEvent[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new RequestTimeoutException({ code: 'SNAPSHOT_TIMEOUT' }));
      }, timeoutMs);
      this.pending.set(requestId, { events: [], received: 0, resolve, timer });
    });
  }

  /** Вызывается листенером на каждую часть report_snapshot. */
  ingest(requestId: string, part: number, totalParts: number, events: RawPicoEvent[]): void {
    const p = this.pending.get(requestId);
    if (!p) {
      this.logger.debug(`snapshot part for unknown/expired requestId=${requestId}`);
      return;
    }
    p.events.push(...events);
    p.received += 1;
    if (p.received >= totalParts) {
      clearTimeout(p.timer);
      this.pending.delete(requestId);
      p.resolve(p.events);
    }
  }
}
