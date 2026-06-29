import type { HardwareEvent, HardwareStatus, RelayControlRequest } from '@tahawash/shared-types';
import { api } from './api';

export async function getBayHardwareStatus(bayId: string): Promise<HardwareStatus> {
  const res = await api.get<HardwareStatus>(`/tenant/bays/${bayId}/hardware/status`);
  return res.data;
}

export async function controlRelay(
  bayId: string,
  dto: RelayControlRequest,
): Promise<void> {
  await api.post(`/tenant/bays/${bayId}/hardware/relay`, dto);
}

export async function requestHardwareSnapshot(bayId: string): Promise<void> {
  await api.post(`/tenant/bays/${bayId}/hardware/snapshot`);
}

/** Тестовое зачисление: имитация оплаты на amount AZN (целое положительное). */
export async function sendHardwareCredit(bayId: string, amount: number): Promise<void> {
  await api.post(`/tenant/bays/${bayId}/hardware/credit`, { amount });
}

export async function getHardwareEvents(
  bayId: string,
  date: string,
): Promise<HardwareEvent[]> {
  const res = await api.get<HardwareEvent[]>(`/tenant/bays/${bayId}/hardware/events`, {
    params: { date },
  });
  return res.data;
}
