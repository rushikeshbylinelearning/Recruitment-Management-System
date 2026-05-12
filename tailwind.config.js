/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'in': 'in 0.2s ease-out',
        'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
        'slide-in-from-top-2': 'slide-in-from-top-2 0.2s ease-out',
      },
      keyframes: {
        'in': {
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
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-visible': {
          'overflow-y': 'scroll',
          'scrollbar-width': 'auto',
          'scrollbar-color': '#94a3b8 #e2e8f0',
          '&::-webkit-scrollbar': {
            width: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#e2e8f0',
            'border-radius': '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#94a3b8',
            'border-radius': '6px',
            border: '2px solid #e2e8f0',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#64748b',
          },
        },
      });
    },
  ],
};
