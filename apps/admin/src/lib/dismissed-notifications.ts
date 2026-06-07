/**
 * Local persistence for dismissed notification ids.
 *
 * Notifications are computed server-side from current state and have
 * deterministic ids (e.g. "sub-expiring-2026-06-15-3d"). Dismissals are
 * a client-side preference — no need to persist to the backend.
 *
 * On day-rollover or state-change, a new id appears and the warning
 * resurfaces (working as intended — yesterday's dismissal shouldn't
 * suppress today's signal).
 */
const KEY = 'tahawash.admin.dismissedNotifications';

export function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function setDismissedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage can throw in private-browsing; silently ignore — the
    // user will see the same notifications again next session, which is
    // a fine fallback.
  }
}

export function dismissNotification(id: string): Set<string> {
  const ids = getDismissedIds();
  ids.add(id);
  setDismissedIds(ids);
  return ids;
}
