import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide TanStack Query client.
 *
 * Wired into the root provider tree in app/_layout.tsx so every screen
 * can use `useQuery` / `useMutation` without re-creating the client.
 *
 * Defaults:
 *   staleTime 60s        — backend data (carwashes, transactions) changes
 *                          slowly; one minute of "fresh" feels right and
 *                          avoids stampeding /public/carwashes when the
 *                          user toggles back to the Wash tab.
 *   retry 1              — one retry for transient network errors. We
 *                          surface failures explicitly in UI rather than
 *                          masking with infinite retries.
 *   refetchOnWindowFocus → off; this is a mobile app, "window focus"
 *                          fires on Activity/App-state changes and
 *                          a full refetch is too aggressive.
 *
 * Per-query overrides come from the call sites where they matter
 * (e.g. version-check has its own short-lived cache).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
