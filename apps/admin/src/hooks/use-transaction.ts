import { useQuery } from '@tanstack/react-query';
import { fetchTenantTransaction, type TenantTransactionDetail } from '@/lib/transactions-api';

export function useTenantTransaction(id: string | null) {
  return useQuery<TenantTransactionDetail>({
    queryKey: id ? ['tenant-transaction', id] : ['tenant-transaction', '__none__'],
    queryFn: () => fetchTenantTransaction(id!),
    enabled: !!id,
  });
}
