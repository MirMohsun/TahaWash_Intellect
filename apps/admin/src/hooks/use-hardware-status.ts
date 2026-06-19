import { useQuery } from '@tanstack/react-query';
import { getBayHardwareStatus } from '../lib/hardware-api';

/**
 * Polling-хук: обновляет статус железа каждые 30 секунд.
 * online = lastSeenAt < 2 минут назад (вычисляется на бэкэнде).
 */
export function useHardwareStatus(bayId: string) {
  return useQuery({
    queryKey: ['hardware-status', bayId],
    queryFn: () => getBayHardwareStatus(bayId),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
