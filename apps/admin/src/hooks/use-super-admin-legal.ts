import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSuperAdminLegalCurrent,
  fetchSuperAdminLegalVersions,
  type LegalCurrentMap,
  type LegalDocType,
  type LegalDocumentRow,
  type LegalLanguage,
  makeSuperAdminLegalCurrent,
  publishSuperAdminLegal,
  type PublishLegalDocumentInput,
} from '@/lib/super-admin-api';

const CURRENT_KEY = ['super-admin-legal-current'] as const;
const versionsKey = (type: LegalDocType, language: LegalLanguage) =>
  ['super-admin-legal-versions', type, language] as const;

export function useSuperAdminLegalCurrent() {
  return useQuery<LegalCurrentMap>({
    queryKey: CURRENT_KEY,
    queryFn: fetchSuperAdminLegalCurrent,
  });
}

export function useSuperAdminLegalVersions(type: LegalDocType, language: LegalLanguage) {
  return useQuery<{ items: LegalDocumentRow[] }>({
    queryKey: versionsKey(type, language),
    queryFn: () => fetchSuperAdminLegalVersions(type, language),
  });
}

export function usePublishSuperAdminLegal(type: LegalDocType, language: LegalLanguage) {
  const qc = useQueryClient();
  return useMutation<LegalDocumentRow, unknown, PublishLegalDocumentInput>({
    mutationFn: (payload) => publishSuperAdminLegal(type, language, payload),
    onSuccess: (row) => {
      qc.setQueryData<LegalCurrentMap>(CURRENT_KEY, (prev) => {
        const base: LegalCurrentMap = prev ?? {
          terms: { az: null, ru: null, en: null },
          privacy: { az: null, ru: null, en: null },
        };
        return {
          ...base,
          [type]: { ...base[type], [language]: row },
        };
      });
      void qc.invalidateQueries({ queryKey: versionsKey(type, language) });
    },
  });
}

export function useMakeSuperAdminLegalCurrent(type: LegalDocType, language: LegalLanguage) {
  const qc = useQueryClient();
  return useMutation<LegalDocumentRow, unknown, string>({
    mutationFn: (id) => makeSuperAdminLegalCurrent(id),
    onSuccess: (row) => {
      qc.setQueryData<LegalCurrentMap>(CURRENT_KEY, (prev) => {
        const base: LegalCurrentMap = prev ?? {
          terms: { az: null, ru: null, en: null },
          privacy: { az: null, ru: null, en: null },
        };
        return {
          ...base,
          [type]: { ...base[type], [language]: row },
        };
      });
      void qc.invalidateQueries({ queryKey: versionsKey(type, language) });
    },
  });
}
