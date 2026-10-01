/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        canvas: '#F2F4F3',
        ink: '#152230',
        muted: '#5B6B7A',
        line: '#DDE3E1',
        brand: { DEFAULT: '#0E4D64', dark: '#0C2B38', soft: '#E3EEF1' },
        growing: { DEFAULT: '#1E7F4F', soft: '#E4F2EA' },
        stable: { DEFAULT: '#2F5E9E', soft: '#E6EDF7' },
        recovering: { DEFAULT: '#0F8B8D', soft: '#E0F2F2' },
        atrisk: { DEFAULT: '#C23A2B', soft: '#FBE9E6' },
        lost: { DEFAULT: '#6B7480', soft: '#ECEEF0' },
        warn: { DEFAULT: '#B7791F', soft: '#FBF1DF' },
      },
      boxShadow: { card: '0 1px 2px rgba(21,34,48,0.06)', pop: '0 12px 32px rgba(21,34,48,0.18)' },
      keyframes: {
        flash: { '0%': { backgroundColor: 'rgba(14,77,100,0.12)' }, '100%': { backgroundColor: 'transparent' } },
        rise: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { flash: 'flash 1.8s ease-out', rise: 'rise .25s ease-out' },
    },
  },
  plugins: [],
};
