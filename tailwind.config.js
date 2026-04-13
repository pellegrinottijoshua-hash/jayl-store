/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Light theme ──────────────────────────────────────────────────
        'ink': '#111111',
        'ink-secondary': '#444444',
        'ink-muted': '#888888',
        'paper': '#f5f0e8',
        'paper-2': '#ede8df',
        'paper-border': '#e8e3dc',
        // ── Dark theme ───────────────────────────────────────────────────
        black: '#000000',
        'off-black': '#0a0a0a',
        'surface': '#111111',
        'surface-2': '#1a1a1a',
        'surface-3': '#222222',
        'border': '#2a2a2a',
        'border-light': '#3a3a3a',
        cream: '#f5f0e8',
        'cream-muted': '#c8c0b0',
        'accent': '#e8d5a3',
        'accent-warm': '#d4a853',
        'accent-cool': '#7eb8c4',
        'text-primary': '#f0ece4',
        'text-secondary': '#9a9590',
        'text-muted': '#5a5550',
        'success': '#4a9e6e',
        'error': '#c0392b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['\'Playfair Display\'', 'Georgia', 'serif'],
        mono: ['\'JetBrains Mono\'', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        'ultra': '0.25em',
        'widest': '0.2em',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease forwards',
        'fade-up': 'fadeUp 0.6s ease forwards',
        'slide-in-right': 'slideInRight 0.4s ease forwards',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      gridTemplateColumns: {
        'product': 'repeat(auto-fill, minmax(280px, 1fr))',
      },
    },
  },
  plugins: [],
}
