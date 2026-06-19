/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ledger: {
          bg: '#0f1419',
          surface: '#1a2332',
          elevated: '#243044',
          border: '#2d3a4f',
          text: '#f4f0e8',
          muted: '#9aa5b8',
          gold: '#c9a962',
          'gold-dim': '#a68b4b',
          sage: '#7d9b8a',
          danger: '#c96b6b',
          success: '#6baf8a',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(201, 169, 98, 0.08)',
        card: '0 4px 24px rgba(0, 0, 0, 0.35)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
