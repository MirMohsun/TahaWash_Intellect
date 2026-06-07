import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AppPlatform,
  type AppVersionResponse,
  type AppVersionRow,
  fetchSuperAdminVersions,
  type UpsertAppVersionInput,
  upsertSuperAdminVersion,
} from '@/lib/super-admin-api';

const KEY = ['super-admin-versions'] as const;

export function useSuperAdminVersions() {
  return useQuery<AppVersionResponse>({
    queryKey: KEY,
    queryFn: fetchSuperAdminVersions,
  });
}

export function useUpsertSuperAdminVersion(platform: AppPlatform) {
  const qc = useQueryClient();
  return useMutation<AppVersionRow, unknown, UpsertAppVersionInput>({
    mutationFn: (payload) => upsertSuperAdminVersion(platform, payload),
    onSuccess: (row) => {
      qc.setQueryData<AppVersionResponse>(KEY, (prev) => {
        const base: AppVersionResponse = prev ?? { ios: null, android: null };
        return { ...base, [platform]: row };
      });
    },
  });
}
