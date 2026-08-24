/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        health: {
          canvas: '#f4fafa',
          surface: '#ffffff',
          muted: '#eaf4f4',
          border: '#cfe3e3',
          accent: '#0f766e',
          'accent-hover': '#115e59',
          text: '#1a3a3a',
          subtle: '#5c7373',
          danger: '#b42318',
          nist: {
            critical: '#9b111e',
            high: '#d32f2f',
            moderate: '#f9a825',
            low: '#1976d2',
            info: '#2e7d32',
          },
        },
      },
      fontFamily: {
        sans: [
          'Segoe UI',
          'Calibri',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
