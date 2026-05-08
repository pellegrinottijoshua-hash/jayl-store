/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── JAYL Brand System ────────────────────────────────────────────
        'jayl-black': '#111111',
        'jayl-cream':  '#F5F0E8',
        'jayl-gray':   '#8A8A85',
        'jayl-gold':   '#C4A35A',
        'jayl-white':  '#FFFFFF',

        // ── Light theme aliases (map to brand) ───────────────────────────
        'ink':          '#111111',   // jayl-black
        'ink-secondary':'#444444',
        'ink-muted':    '#8A8A85',   // jayl-gray
        'paper':        '#F5F0E8',   // jayl-cream
        'paper-2':      '#EDE8DF',
        'paper-border': '#DDD8D0',

        // ── Dark theme (store dark sections / admin) ─────────────────────
        black:          '#000000',
        'off-black':    '#0a0a0a',
        'surface':      '#111111',   // jayl-black
        'surface-2':    '#1a1a1a',
        'surface-3':    '#222222',
        'border':       '#2a2a2a',
        'border-light': '#3a3a3a',
        cream:          '#F5F0E8',   // jayl-cream
        'cream-muted':  '#C8C0B0',

        // ── Accent → JAYL Gold ───────────────────────────────────────────
        'accent':       '#C4A35A',   // jayl-gold (primary accent)
        'accent-warm':  '#C4A35A',   // same — gold is the only warm accent
        'accent-light': '#D4B878',   // gold light tint
        'accent-cool':  '#7eb8c4',   // kept for legacy uses

        // ── Dark text ────────────────────────────────────────────────────
        'text-primary':   '#F0ECE4',
        'text-secondary': '#8A8A85', // jayl-gray
        'text-muted':     '#5A5550',

        // ── Status ───────────────────────────────────────────────────────
        'success': '#4a9e6e',
        'error':   '#c0392b',
      },

      fontFamily: {
        // Display / Nav / Labels / UI → Space Grotesk
        sans:    ['Space Grotesk', 'system-ui', 'sans-serif'],
        // Editorial / Body / Payoff → Cormorant Garamond
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        // Admin / Code
        mono:    ['JetBrains Mono', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },

      letterSpacing: {
        // Brand letter-spacing system
        'display': '0.08em',   // nav/display items
        'label':   '0.15em',   // labels, small caps
        'label-xl':'0.20em',   // widest labels
        'ultra':   '0.25em',   // kept for legacy
        'widest':  '0.20em',
      },

      animation: {
        'fade-in':        'fadeIn 0.5s ease forwards',
        'fade-up':        'fadeUp 0.55s ease forwards',
        'slide-in-right': 'slideInRight 0.4s ease forwards',
        'slide-in-left':  'slideInLeft 0.4s ease forwards',
        'shimmer':        'shimmer 2s infinite linear',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
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
