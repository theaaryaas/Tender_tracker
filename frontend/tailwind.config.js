/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Lavender Dream Palette (Exact user specifications)
        lavender: {
          light: '#E6E6FA',      // Lavender Mist
          thistle: '#D8BFD8',    // Soft Thistle
          peach: '#FFDAB9',      // Peach Puff
          sage: '#C8D8C4',       // Sage Mist
          heather: '#C3C1CD',    // Heather Slate
          primary: '#6B46C1',    // Deep Iris Violet (High-contrast CTA)
          primaryHover: '#553C9A',
          primaryLight: '#F3E8FF',
          canvas: '#FAF9FD',     // Airy Canvas Background
          surface: '#FFFFFF',    // Pure White Card Surface
          cardBorder: '#E2DEEC', // Subtle Lavender Border
          ink: '#1E182B',        // Deep Twilight Text
          inkMuted: '#584E6B',   // Muted Text
          inkSubtle: '#8C82A0',  // Subtle Labels
          sidebar: '#141021',    // Twilight Anchor Sidebar
        },
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9ddfd',
          300: '#7cc2fb',
          400: '#36a3f7',
          500: '#0c87eb',
          600: '#006bc9',
          700: '#0155a3',
          800: '#054885',
          900: '#0a3c6f',
          950: '#07274a',
        }
      }
    },
  },
  plugins: [],
}
