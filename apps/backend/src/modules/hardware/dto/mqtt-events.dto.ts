/**
 * Типы MQTT-сообщений, которые Pico отправляет на топик
 * tahawash/hardware/{hardwareId}/status
 */

export interface AckEvent {
  type: 'ack';
  device: string;
  txId: string;
  credited: boolean;
  error?: string;
  ts: string;
}

export interface CashEvent {
  type: 'payment_event';
  source: 'cash';
  device: string;
  amount: number;
  ts: string;
}

export interface HeartbeatEvent {
  type: 'heartbeat';
  device: string;
  uptime: number;
  relays: Record<string, number>; // { fn2: 0, fn3: 1, ... } (0=выкл, 1=вкл)
  eventsToday: number;
  pendingReport: string | null;
  activeFunction: string | null;
  ts: string;
}

export interface DailyReportEvent {
  type: 'daily_report';
  device: string;
  date: string; // YYYY-MM-DD
  part: number;
  totalParts: number;
  count: number;
  events: RawPicoEvent[];
  ts: string;
}

export interface ReportSnapshotEvent {
  type: 'report_snapshot';
  device: string;
  date: string;
  count: number;
  events: RawPicoEvent[];
  ts: string;
}

export type MqttStatusEvent =
  | AckEvent
  | CashEvent
  | HeartbeatEvent
  | DailyReportEvent
  | ReportSnapshotEvent;

// Сырое событие внутри daily_report
export interface RawPicoEvent {
  type: 'cash' | 'online' | 'usage' | 'anomaly';
  ts: string;
  device: string;
  amount?: number;
  pulses?: number;
  txId?: string;
  program?: string;
  programName?: string;
  combo?: string[];
  name?: string;
  durationS?: number;
  note?: string;
}

/**
 * Типы команд, которые бэкэнд отправляет на топик
 * tahawash/hardware/{hardwareId}/control
 */

export type CreditCommand = {
  type: 'credit';
  txId: string;
  amount: number;
  programPin?: string;
};

export type RelayCommand = {
  type: 'relay';
  pin: string;
  action: 'on' | 'off';
  duration?: number;
};

export type GetReportCommand = {
  type: 'get_report';
};

export type ReportAckCommand = {
  type: 'report_ack';
  date: string;
};

export type MqttControlCommand =
  | CreditCommand
  | RelayCommand
  | GetReportCommand
  | ReportAckCommand;
