import { useEffect, useState } from 'react';
import { checkVersion, type VersionCheckResult } from '../lib/version-check';
import { useAppFonts } from '../theme/use-app-fonts';

/**
 * Boot-time state for the app:
 *   - waits for fonts to load (Inter — blocking)
 *   - calls GET /public/version (best-effort; never blocks for >10s)
 *   - reports back to the root layout so it can render either
 *     ForceUpdateScreen or the normal Stack
 *
 * Why a hook (not a thunk in _layout): we need the version state to
 * trigger a re-render and we want the splash-hide effect to fire only
 * after BOTH fonts AND version are settled. Co-locating both as state
 * keeps the orchestration easy to follow.
 */
export type BootstrapState =
  | { phase: 'loading' }
  | { phase: 'force-update'; version: Extract<VersionCheckResult, { status: 'force-update' }> }
  | { phase: 'ready' };

export function useAppBootstrap(): BootstrapState {
  const fonts = useAppFonts();
  const [versionResult, setVersionResult] = useState<VersionCheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkVersion()
      .then((res) => {
        if (!cancelled) setVersionResult(res);
      })
      .catch(() => {
        // Should be impossible — checkVersion catches its own errors and
        // returns { status: 'unknown' } — but belt-and-suspenders.
        if (!cancelled) setVersionResult({ status: 'unknown', reason: 'network' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fontsSettled = fonts.loaded || fonts.error;
  const versionSettled = versionResult !== null;

  if (!fontsSettled || !versionSettled) {
    return { phase: 'loading' };
  }

  if (versionResult.status === 'force-update') {
    return { phase: 'force-update', version: versionResult };
  }

  return { phase: 'ready' };
}
