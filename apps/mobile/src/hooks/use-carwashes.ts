import { useQuery } from '@tanstack/react-query';
import { listCarwashes, type ListCarwashesParams } from '../lib/carwashes-api';

/**
 * TanStack Query wrapper over `GET /public/carwashes`.
 *
 * Cache key includes every filter param so the user toggling
 * radius/center doesn't share results with a previous query.
 * staleTime is 60s globally (see query-client.ts); we let that defaults
 * apply unless the call site overrides.
 */
export function useCarwashes(params: ListCarwashesParams = {}) {
  return useQuery({
    queryKey: ['carwashes', params],
    queryFn: () => listCarwashes(params),
  });
}
