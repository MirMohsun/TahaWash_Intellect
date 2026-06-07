import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Bell, Check, Info, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenantNotifications } from '@/hooks/use-notifications';
import { formatActivityTime } from '@/lib/baku-day';
import { dismissNotification, getDismissedIds } from '@/lib/dismissed-notifications';
import type {
  NotificationSeverity,
  NotificationType,
  TenantNotification,
} from '@/lib/notifications-api';

/**
 * Top-bar notification bell (B10.2).
 *
 * Dropdown menu listing all live notifications. Each item renders with:
 *   - a severity icon (error / warning / info color tones)
 *   - title + body (i18n keys, vars from data)
 *   - relative time
 *   - dismiss "×" button (persists to localStorage)
 *   - clicking the body navigates to the optional `link` (if any)
 *
 * Unread badge counts non-dismissed items. "Mark all as read" dismisses
 * everything in one click.
 *
 * Server refetch is 60s so subscription lifecycle rolls over naturally.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const { data } = useTenantNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissedIds());
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const items = data ?? [];
  const visible = useMemo(() => items.filter((n) => !dismissed.has(n.id)), [items, dismissed]);

  const onDismiss = (id: string) => {
    const next = dismissNotification(id);
    setDismissed(new Set(next));
  };
  const onDismissAll = () => {
    let next = new Set(dismissed);
    for (const item of items) next = dismissNotification(item.id);
    setDismissed(new Set(next));
  };
  const onItemClick = (n: TenantNotification) => {
    setOpen(false);
    if (n.link) void navigate({ to: n.link });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('tenantAdmin.notifications.openLabel')}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-full text-ink-500 hover:text-ink-900 hover:bg-line-soft transition-colors"
      >
        <Bell className="h-5 w-5" />
        {visible.length > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold leading-none tabular-nums">
            {visible.length > 9 ? '9+' : visible.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-card border border-line bg-bg-elev shadow-pop z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <p className="font-semibold text-ink-900">{t('tenantAdmin.notifications.title')}</p>
            {visible.length > 0 && (
              <button
                type="button"
                onClick={onDismissAll}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                {t('tenantAdmin.notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* Body */}
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-ink-300 mx-auto mb-2" />
              <p className="text-sm text-ink-500">{t('tenantAdmin.notifications.empty')}</p>
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto divide-y divide-line-soft">
              {visible.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onDismiss={() => onDismiss(n.id)}
                  onClick={() => onItemClick(n)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────

function NotificationRow({
  n,
  onDismiss,
  onClick,
}: {
  n: TenantNotification;
  onDismiss: () => void;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="px-4 py-3 hover:bg-line-soft/50 transition-colors">
      <div className="flex items-start gap-3">
        <SeverityIcon severity={n.severity} />
        <button type="button" onClick={onClick} className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-sm text-ink-900">
            {t(`tenantAdmin.notifications.types.${n.type}.title`, n.data)}
          </p>
          <p className="mt-0.5 text-sm text-ink-700 leading-snug">
            {t(`tenantAdmin.notifications.types.${n.type}.body`, n.data)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {formatActivityTime(n.occurredAt, t, new Date())}
          </p>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-ink-400 hover:text-ink-700 shrink-0"
          aria-label={t('tenantAdmin.notifications.dismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  const cls = 'h-5 w-5 shrink-0 mt-0.5';
  if (severity === 'error') return <XCircle className={`${cls} text-error`} />;
  if (severity === 'warning') return <AlertTriangle className={`${cls} text-amber`} />;
  return <Info className={`${cls} text-brand-500`} />;
}

// Re-export the type so AppShell doesn't need a circular import (some
// bundlers complain otherwise). Unused intentionally if AppShell only
// imports NotificationBell.
export type { NotificationType };
