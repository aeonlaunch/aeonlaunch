/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        crt: {
          bg: '#080404',
          surface: '#0e0808',
          'surface-2': '#140c0c',
          border: '#2a1212',
          'border-bright': '#dc2626',
          text: '#f0e0e0',
          dim: '#cc6666',
          accent: '#ef4444',
          'accent-bright': '#ff3333',
          'accent-glow': '#ff4444',
          'accent-dark': '#dc2626',
          link: '#ff4444',
          'link-hover': '#ff6666',
          green: '#34d399',
          orange: '#fbbf24',
        },
        rank: {
          gold: '#ffd700',
          silver: '#c0c0c0',
          bronze: '#cd7f32',
        },
      },
      fontSize: {
        'game-xs': ['11px', { lineHeight: '1.4' }],
        'game-sm': ['14px', { lineHeight: '1.4' }],
        'game-base': ['16px', { lineHeight: '1.4' }],
        'game-lg': ['20px', { lineHeight: '1.3' }],
        'game-xl': ['24px', { lineHeight: '1.2' }],
        'game-2xl': ['28px', { lineHeight: '1.2' }],
        'game-3xl': ['36px', { lineHeight: '1.1' }],
        'game-4xl': ['48px', { lineHeight: '1' }],
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        brand: ['"Press Start 2P"', 'monospace'],
        mono: ['"SF Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      animation: {
        'blink-cursor': 'blink-cursor 1s step-end infinite',
        'card-in': 'card-in 0.15s forwards',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        appear: 'appear 0.08s forwards',
        'power-fill': 'power-fill 0.6s ease-out forwards',
        'rank-glow': 'rank-glow 2s ease-in-out infinite',
        'action-pop': 'action-pop 0.3s ease-out forwards',
      },
      keyframes: {
        'blink-cursor': {
          '50%': { opacity: '0' },
        },
        'card-in': {
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        appear: {
          to: { opacity: '1' },
        },
        'power-fill': {
          from: { width: '0%' },
          to: { width: 'var(--fill-width, 0%)' },
        },
        'rank-glow': {
          '0%, 100%': { opacity: '0.7', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.3)' },
        },
        'action-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
