import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        // Brand — Tahawash blue (locked 2026-05-27)
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          900: 'var(--brand-900)',
        },
        // Accent — coral
        accent: {
          50: 'var(--accent-50)',
          500: 'var(--accent-500)',
        },
        // Neutrals
        bg: 'var(--bg)',
        'bg-elev': 'var(--bg-elev)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        ink: {
          300: 'var(--ink-300)',
          400: 'var(--ink-400)',
          500: 'var(--ink-500)',
          700: 'var(--ink-700)',
          800: 'var(--ink-800)',
          900: 'var(--ink-900)',
        },
        // Semantic
        success: {
          DEFAULT: 'var(--success)',
          50: 'var(--success-50)',
        },
        error: {
          DEFAULT: 'var(--error)',
          50: 'var(--error-50)',
        },
        amber: {
          DEFAULT: 'var(--amber)',
          50: 'var(--amber-50)',
        },
      },
      borderRadius: {
        card: 'var(--r-card)',
        'card-sm': 'var(--r-card-sm)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        card: 'var(--sh-card)',
        pop: 'var(--sh-pop)',
        fab: 'var(--sh-fab)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.01em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
