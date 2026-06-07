/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 requires this preset
  presets: [require('nativewind/preset')],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — Tahawash blue (locked 2026-05-27 — REVISED from aqua-teal)
        brand: {
          50: '#FAFEFF',
          100: '#5099D4',
          200: '#4692E3',
          500: '#0E7AE7',
          600: '#2276D6',
          700: '#1C5AD6',
          900: '#1741BF',
        },
        // Accent — coral
        accent: {
          50: '#FFE9E3',
          500: '#FF6E54',
        },
        // Neutrals
        bg: '#F6F7F8',
        'bg-elev': '#FFFFFF',
        line: '#ECEEF1',
        'line-soft': '#F2F3F5',
        ink: {
          300: '#C5CAD2',
          400: '#9AA1AB',
          500: '#6B7280',
          700: '#3A4250',
          800: '#1F2531',
          900: '#14181F',
        },
        // Semantic (success changed from green #10B981 to blue #0F65F2 on 2026-05-27 per user)
        success: '#0F65F2',
        'success-50': '#E6F8F0',
        error: '#EF4444',
        'error-50': '#FEECEC',
        amber: '#F59E0B',
        'amber-50': '#FFF6E5',
      },
      borderRadius: {
        card: '16px',
        'card-sm': '12px',
        pill: '999px',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        mono: ['JetBrainsMono', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.01em',
      },
    },
  },
  plugins: [],
};
