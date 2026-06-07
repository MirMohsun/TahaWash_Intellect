import { api, appMeta } from './api';
import { compareVersions } from './version-compare';

/**
 * Server response from GET /public/version?platform=...
 * Shape mirrors AppVersionInfo in @tahawash/shared-types.
 */
interface VersionPolicy {
  platform: 'ios' | 'android';
  latestVersion: string;
  minimumVersion: string;
  releaseNotes: string | null;
  updatedAt: string;
}

export type VersionCheckResult =
  | {
      status: 'up-to-date';
      bundled: string;
      latestVersion: string;
    }
  | {
      status: 'update-available';
      bundled: string;
      latestVersion: string;
      releaseNotes: string | null;
    }
  | {
      status: 'force-update';
      bundled: string;
      minimumVersion: string;
      latestVersion: string;
      releaseNotes: string | null;
    }
  | {
      status: 'unknown';
      reason: 'network' | 'not-configured' | 'parse-error';
    };

/**
 * Decide whether the running app needs an update.
 *
 *   bundled >= latest     → up-to-date     (no UI)
 *   bundled < latest      → update-available (soft prompt — Phase 2.11 will
 *                            surface this on the Main tab; for now just signal)
 *   bundled < minimum     → force-update   (blocking modal)
 *
 * Network failure / missing policy on the server are mapped to `unknown`.
 * The orchestrator (use-app-bootstrap) treats `unknown` as proceed —
 * we never want a transient API outage to brick the app behind a modal.
 */
export async function checkVersion(): Promise<VersionCheckResult> {
  const bundled = appMeta.version;

  let policy: VersionPolicy;
  try {
    const res = await api.get<VersionPolicy>('/public/version', {
      params: { platform: appMeta.platform },
    });
    policy = res.data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return { status: 'unknown', reason: 'not-configured' };
    }
    return { status: 'unknown', reason: 'network' };
  }

  if (!policy?.latestVersion || !policy?.minimumVersion) {
    return { status: 'unknown', reason: 'parse-error' };
  }

  try {
    const vsMin = compareVersions(bundled, policy.minimumVersion);
    if (vsMin < 0) {
      return {
        status: 'force-update',
        bundled,
        minimumVersion: policy.minimumVersion,
        latestVersion: policy.latestVersion,
        releaseNotes: policy.releaseNotes,
      };
    }
    const vsLatest = compareVersions(bundled, policy.latestVersion);
    if (vsLatest < 0) {
      return {
        status: 'update-available',
        bundled,
        latestVersion: policy.latestVersion,
        releaseNotes: policy.releaseNotes,
      };
    }
    return {
      status: 'up-to-date',
      bundled,
      latestVersion: policy.latestVersion,
    };
  } catch {
    return { status: 'unknown', reason: 'parse-error' };
  }
}
