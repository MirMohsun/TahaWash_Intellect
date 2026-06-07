import { useQuery } from '@tanstack/react-query';
import { listFeatured, type FeaturedTenantItem } from '../lib/featured-api';
import { listActivePromos, type PublicPromo } from '../lib/promos-api';

/**
 * Hooks specific to the Main tab (Phase 2.11). Wrapping each list in
 * its own query lets sections render + refresh independently.
 */

export function useActivePromos() {
  return useQuery<PublicPromo[]>({
    queryKey: ['public-promos'],
    queryFn: listActivePromos,
    staleTime: 5 * 60_000,
  });
}

export function useFeaturedTenants() {
  return useQuery<FeaturedTenantItem[]>({
    queryKey: ['public-featured'],
    queryFn: listFeatured,
    staleTime: 5 * 60_000,
  });
}
