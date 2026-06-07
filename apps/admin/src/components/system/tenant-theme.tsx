/**
 * TenantThemeProvider — paints the active tenant's brand color into the
 * authenticated shell.
 *
 * The default Tahawash blue (#0E7AE7) is set globally in `index.css`. Once
 * a tenant logs in, this provider OVERRIDES `--brand-500/600/700` at the
 * <html> root with shades derived from the tenant's stored themeColor.
 * Anywhere the admin UI uses `bg-brand-500` / `text-brand-600` etc. picks
 * up the tenant's hue automatically — no per-component theme prop.
 *
 * Why shades, not just one color: shadcn primitives (button, focus rings,
 * card hover states) use multiple brand stops. Deriving a 600/700 darker
 * variant keeps depth consistent across tenants.
 *
 * Defensive: if the tenant's themeColor isn't a valid 6-char hex (legacy
 * data, accidental edit) we no-op and the default Tahawash blue persists.
 */
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../../store/auth';

const TAHAWASH_DEFAULT = {
  '--brand-500': '#0e7ae7',
  '--brand-600': '#2276d6',
  '--brand-700': '#1c5ad6',
};

export function TenantThemeProvider({ children }: { children: ReactNode }) {
  const themeColor = useAuthStore((s) => s.tenant?.themeColor ?? null);

  useEffect(() => {
    const root = document.documentElement;
    const shades = computeTenantShades(themeColor);
    for (const [key, value] of Object.entries(shades)) {
      root.style.setProperty(key, value);
    }
    return () => {
      // Reset back to Tahawash defaults on unmount (e.g. logout).
      for (const [key, value] of Object.entries(TAHAWASH_DEFAULT)) {
        root.style.setProperty(key, value);
      }
    };
  }, [themeColor]);

  return <>{children}</>;
}

function computeTenantShades(themeColor: string | null) {
  if (!themeColor || !isValidHex(themeColor)) return TAHAWASH_DEFAULT;
  return {
    '--brand-500': themeColor,
    '--brand-600': darken(themeColor, 0.08),
    '--brand-700': darken(themeColor, 0.16),
  };
}

function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** Returns a hex darker by `amount` (0–1) using a simple RGB scale. */
function darken(hex: string, amount: number): string {
  const m = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex);
  if (!m || !m[1] || !m[2] || !m[3]) return hex;
  const r = clamp(Math.round(parseInt(m[1], 16) * (1 - amount)));
  const g = clamp(Math.round(parseInt(m[2], 16) * (1 - amount)));
  const b = clamp(Math.round(parseInt(m[3], 16) * (1 - amount)));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, n));
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}
