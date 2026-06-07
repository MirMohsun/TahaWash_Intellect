import { useEffect, useState } from 'react';
import { getIntroSeen } from '../lib/intro-store';

export type IntroState = 'unknown' | 'seen' | 'unseen';

/**
 * Resolves the intro-seen state from SecureStore exactly once per app launch.
 *
 *  - `unknown` — read in progress (typically <50ms). The gate renders the
 *    boot spinner in this case so we never flash the wrong screen.
 *  - `seen` — user has completed (or skipped) the intro before; skip
 *    straight to phone entry.
 *  - `unseen` — first-launch path; show the intro.
 *
 * SecureStore read is fast but async; we deliberately don't read it
 * synchronously via a top-level `await` because Expo SecureStore's API
 * is Promise-based on both platforms.
 */
export function useIntroState(): IntroState {
  const [state, setState] = useState<IntroState>('unknown');

  useEffect(() => {
    let cancelled = false;
    void getIntroSeen().then((seen) => {
      if (cancelled) return;
      setState(seen ? 'seen' : 'unseen');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
