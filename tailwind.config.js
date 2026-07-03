import colors from 'tailwindcss/colors';

/** Red / White / Black brand palette (20% / 70% / 10% usage ratio) */
const brandRed = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
};

const brandNeutral = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#d4d4d4',
  400: '#a3a3a3',
  500: '#737373',
  600: '#525252',
  700: '#404040',
  800: '#262626',
  900: '#0a0a0a',
  950: '#050505',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          red: '#dc2626',
          'red-dark': '#b91c1c',
          'red-light': '#fee2e2',
          white: '#ffffff',
          'white-soft': '#fafafa',
          black: '#0a0a0a',
          'black-muted': '#171717',
        },
        surface: {
          DEFAULT: '#f8fafc',
          dark: '#0f172a',
          card: '#ffffff',
          'card-dark': '#1e293b',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        glass: '0 4px 24px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'glass-lg': '0 12px 40px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06)',
        'glow-red': '0 0 24px rgba(239, 68, 68, 0.25)',
        'card-hover': '0 20px 40px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(239, 68, 68, 0.15)',
      },
      animation: {
        in: 'in 0.2s ease-out',
        'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
        'slide-in-from-top-2': 'slide-in-from-top-2 0.2s ease-out',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out forwards',
      },
      keyframes: {
        in: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-from-top': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-from-top-2': {
          '0%': { opacity: '0', transform: 'translateY(-5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
    colors: {
      ...colors,
      blue: brandRed,
      indigo: brandRed,
      violet: brandRed,
      purple: brandRed,
      sky: brandRed,
      gray: brandNeutral,
      slate: brandNeutral,
      zinc: brandNeutral,
      neutral: brandNeutral,
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-visible': {
          'overflow-y': 'scroll',
          'scrollbar-width': 'auto',
          'scrollbar-color': '#dc2626 #f5f5f5',
          '&::-webkit-scrollbar': {
            width: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f5f5f5',
            'border-radius': '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#dc2626',
            'border-radius': '6px',
            border: '2px solid #f5f5f5',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#b91c1c',
          },
        },
      });
    },
  ],
};
