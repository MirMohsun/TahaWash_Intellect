/**
 * App version targeting — used by the force-update mechanism (locked spec).
 * Mobile app fetches this on launch; if its version < minimum, blocks with
 * a modal directing to the store.
 */

export type AppPlatform = 'ios' | 'android';

export interface AppVersionInfo {
  platform: AppPlatform;
  latestVersion: string;
  minimumVersion: string;
  releaseNotes: string | null;
  updatedAt: string;
}

export interface VersionCheckResponse {
  ios: Pick<AppVersionInfo, 'latestVersion' | 'minimumVersion' | 'releaseNotes'>;
  android: Pick<AppVersionInfo, 'latestVersion' | 'minimumVersion' | 'releaseNotes'>;
}
