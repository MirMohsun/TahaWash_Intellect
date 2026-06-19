/**
 * Типы, связанные с Raspberry Pi Pico 2W hardware bridge.
 * Используются в admin UI и backend.
 */

export interface HardwareStatus {
  hardwareIdentifier: string | null;
  online: boolean;
  lastSeenAt: string | null;
  relays: Record<string, number> | null; // { fn2: 0, fn3: 1, ... }
}

export interface HardwareEvent {
  id: string;
  eventType: 'cash' | 'online' | 'usage' | 'anomaly';
  amountAzn: string | null;
  pulses: number | null;
  txId: string | null;
  programName: string | null;
  durationSeconds: number | null;
  relayCombo: string[];
  reportDate: string;
  rawTs: string;
  createdAt: string;
}

export type RelayPin = 'fn2' | 'fn3' | 'fn4' | 'fn5' | 'fn6' | 'pause';

export interface RelayControlRequest {
  pin: RelayPin;
  action: 'on' | 'off';
  duration?: number;
}
