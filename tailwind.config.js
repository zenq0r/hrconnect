/** @type {import('tailwindcss').Config} */
module.exports = {
  // Every file that carries a class name. The screens live in views/ and the
  // status styles assembled at runtime live in app/, so leaving either out
  // makes a rebuild silently drop the classes only they use.
  content: ['./index.html', './app.js', './app/**/*.js', './views/**/*.html'],
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
