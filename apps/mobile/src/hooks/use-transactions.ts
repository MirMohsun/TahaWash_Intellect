import { useQuery } from '@tanstack/react-query';
import { getMyTransaction, listMyTransactions } from '../lib/transactions-api';

/** Paginated list — first page only for now. Infinite scroll lands in Phase 2.14 QA. */
export function useMyTransactions(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['my-transactions', { page, pageSize }],
    queryFn: () => listMyTransactions({ page, pageSize }),
    // History rarely changes mid-session — 30s stale buys us snappiness.
    staleTime: 30_000,
  });
}

export function useMyTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['my-transaction', id],
    queryFn: () => getMyTransaction(id!),
    enabled: Boolean(id),
  });
}
