import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSuperAdminSettings,
  type PlatformSettingsMap,
  type UpdatePlatformSettingsInput,
  updateSuperAdminSettings,
} from '@/lib/super-admin-api';

const KEY = ['super-admin-settings'] as const;

export function useSuperAdminSettings() {
  return useQuery<PlatformSettingsMap>({
    queryKey: KEY,
    queryFn: fetchSuperAdminSettings,
  });
}

export function useUpdateSuperAdminSettings() {
  const qc = useQueryClient();
  return useMutation<PlatformSettingsMap, unknown, UpdatePlatformSettingsInput>({
    mutationFn: (payload) => updateSuperAdminSettings(payload),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
    },
  });
}
