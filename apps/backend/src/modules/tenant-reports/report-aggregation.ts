/**
 * Агрегация событий железа в отчётные итоги. Общая для двух источников:
 *  - исторический daily-отчёт (HardwareEvent из БД),
 *  - текущий снимок (RawPicoEvent с Pico по запросу).
 * Оба нормализуются в NormalizedEvent перед агрегацией.
 */

export interface NormalizedEvent {
  eventType: string; // cash | online | usage | anomaly
  amountAzn: number | null;
  programName: string | null;
}

export interface ReportTotals {
  revenueAzn: string; // cash + online
  cashAzn: string;
  onlineAzn: string;
  eventCount: number;
  byType: Record<string, number>;
  byProgram: Array<{ programName: string; count: number; amountAzn: string }>;
}

const money = (n: number): string => n.toFixed(2);

export function aggregateTotals(events: NormalizedEvent[]): ReportTotals {
  let cash = 0;
  let online = 0;
  const byType: Record<string, number> = {};
  const prog = new Map<string, { count: number; amount: number }>();

  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
    const amt = e.amountAzn ?? 0;
    if (e.eventType === 'cash') cash += amt;
    else if (e.eventType === 'online') online += amt;
    if (e.programName) {
      const p = prog.get(e.programName) ?? { count: 0, amount: 0 };
      p.count += 1;
      p.amount += amt;
      prog.set(e.programName, p);
    }
  }

  return {
    revenueAzn: money(cash + online),
    cashAzn: money(cash),
    onlineAzn: money(online),
    eventCount: events.length,
    byType,
    byProgram: [...prog.entries()]
      .map(([programName, v]) => ({ programName, count: v.count, amountAzn: money(v.amount) }))
      .sort((a, b) => Number(b.amountAzn) - Number(a.amountAzn)),
  };
}
