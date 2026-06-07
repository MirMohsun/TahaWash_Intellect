import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFavorite as apiAddFavorite,
  listMyFavorites,
  removeFavorite as apiRemoveFavorite,
  type FavoriteItem,
} from '../lib/customers-api';

const FAVORITES_KEY = ['favorites'] as const;

/**
 * Lists the current customer's favorited tenants. Used by Main tab's
 * favorites strip (Phase 2.11) AND by the Tenant brand page to know
 * whether the heart should render as solid or outline.
 */
export function useFavorites() {
  return useQuery<FavoriteItem[]>({
    queryKey: FAVORITES_KEY,
    queryFn: listMyFavorites,
  });
}

/**
 * Optimistic favorite toggle.
 *
 * Local state updates instantly (heart fills/empties). If the server
 * call fails we roll back. After settling we revalidate the favorites
 * list so it stays in sync with reality (and the Main tab strip
 * updates without a refetch).
 */
export function useToggleFavorite(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ next }: { next: boolean }) => {
      if (next) await apiAddFavorite(tenantId);
      else await apiRemoveFavorite(tenantId);
    },
    onMutate: async ({ next }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = queryClient.getQueryData<FavoriteItem[]>(FAVORITES_KEY) ?? [];
      const optimistic = next
        ? // Add a stub entry — we don't know the full tenant payload here,
          // but the brand-page heart only cares about presence.
          previous.find((f) => f.tenantId === tenantId)
          ? previous
          : [
              ...previous,
              {
                tenantId,
                createdAt: new Date().toISOString(),
                tenant: {
                  id: tenantId,
                  brandName: '',
                  logoUrl: null,
                  themeColor: '#0E7AE7',
                  heroPhotoUrl: null,
                },
              } satisfies FavoriteItem,
            ]
        : previous.filter((f) => f.tenantId !== tenantId);
      queryClient.setQueryData(FAVORITES_KEY, optimistic);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on failure.
      if (context?.previous) {
        queryClient.setQueryData(FAVORITES_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
  });
}

/** Fast presence check — avoids a derived useMemo at every call site. */
export function useIsFavorite(tenantId: string): boolean {
  const favorites: FavoriteItem[] = useFavorites().data ?? [];
  return favorites.some((f) => f.tenantId === tenantId);
}
