/** @type {import('tailwindcss').Config} */
module.exports = {
  // UI status styles are also assembled in app.js. Including it prevents
  // Tailwind from dropping dark-mode variants that only appear at runtime.
  content: ['./index.html', './app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#18212F',
          blue: '#0F766E',
          gold: '#E76F51',
          light: '#F8FAFC',
          card: '#253247',
          border: '#CBD5E1',
          bg: '#111827'
        }
      }
    }
  },
  plugins: []
};
