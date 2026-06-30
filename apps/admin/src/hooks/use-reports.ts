import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchDailyReport,
  requestBaySnapshot,
  type DailyReport,
  type SnapshotReport,
} from '@/lib/reports-api';

/**
 * Ежедневный отчёт из БД. `keepPreviousData`, чтобы при смене даты/бокса
 * таблицы не мигали пустотой (как в financials).
 */
export function useDailyReport(from: string, to: string, bayId?: string) {
  return useQuery<DailyReport>({
    queryKey: ['daily-report', from, to, bayId ?? null],
    queryFn: () => fetchDailyReport({ from, to, bayId }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Текущий срез «по кнопке»: POST → backend синхронно ждёт ответ Pico.
 * Мутация (не query), т.к. это явное действие пользователя с побочкой
 * (отправка команды на железо).
 */
export function useBaySnapshot() {
  return useMutation<SnapshotReport, unknown, string>({
    mutationFn: (bayId: string) => requestBaySnapshot(bayId),
  });
}
