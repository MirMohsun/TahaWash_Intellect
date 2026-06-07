/**
 * Tahawash brand logo — water-drop with wash-arc cut.
 *
 * The gradient was REVISED to blue palette on 2026-05-27 to align with the
 * brand pivot from aqua-teal to blue (see DESIGN_SYSTEM_LOCKED memory).
 * Original mobile design file used #3DD7E8 → #0894A6; now #4692E3 → #2276D6.
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      aria-label="Tahawash logo"
      role="img"
    >
      <defs>
        <linearGradient id="tahawash-logo-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4692E3" />
          <stop offset="100%" stopColor="#2276D6" />
        </linearGradient>
      </defs>
      <path
        d="M20 4c5 6 11 13 11 19a11 11 0 0 1-22 0c0-6 6-13 11-19z"
        fill="url(#tahawash-logo-gradient)"
      />
      <path
        d="M14 24c2 2 4 3 6 3s4-1 6-3"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function LogoLockup({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Logo size={size} />
      <span className="text-lg font-extrabold tracking-tight text-ink-900">Tahawash</span>
    </div>
  );
}
