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

/**
 * Сессия = оплата и последующие функции, использованные до следующей оплаты.
 * Строится из хронологического потока событий: cash/online начинают сессию,
 * usage-события «прицепляются» к текущей. usage без предшествующей оплаты —
 * сессия без платежа (paymentType=null). anomaly в сессии не учитываем.
 */
export interface SessionEventInput {
  eventType: string;
  amountAzn: string | null;
  programName: string | null;
  relayCombo: string[];
  rawTs: string;
}

export interface ReportSession {
  startedAt: string;
  paymentType: 'cash' | 'online' | null;
  amountAzn: string | null;
  program: string | null;
  functions: Array<{ name: string; at: string }>;
}

export function buildSessions(events: SessionEventInput[]): ReportSession[] {
  const sessions: ReportSession[] = [];
  let current: ReportSession | null = null;

  for (const e of events) {
    if (e.eventType === 'cash' || e.eventType === 'online') {
      current = {
        startedAt: e.rawTs,
        paymentType: e.eventType,
        amountAzn: e.amountAzn,
        program: e.programName ?? null,
        functions: [],
      };
      sessions.push(current);
    } else if (e.eventType === 'usage') {
      const fn = { name: e.programName ?? (e.relayCombo.join('+') || '—'), at: e.rawTs };
      if (current) {
        current.functions.push(fn);
      } else {
        current = {
          startedAt: e.rawTs,
          paymentType: null,
          amountAzn: null,
          program: null,
          functions: [fn],
        };
        sessions.push(current);
      }
    }
  }

  return sessions;
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
