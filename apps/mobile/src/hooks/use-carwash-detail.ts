import { useQuery } from '@tanstack/react-query';
import { getCarwashById } from '../lib/carwashes-api';

/**
 * Fetches a single carwash's full brand-page payload. Used by the
 * Tenant brand page (Phase 2.6).
 *
 * Returns 404 CARWASH_NOT_FOUND when the tenant has been deleted /
 * hidden / suspended / pending — the screen handles that explicitly.
 */
export function useCarwashDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['carwash-detail', id],
    queryFn: () => getCarwashById(id!),
    enabled: Boolean(id),
  });
}
