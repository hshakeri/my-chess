/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        board: {
          light: '#f0d9b5',
          dark: '#b58863',
          highlight: 'rgba(255, 255, 0, 0.4)',
          selected: 'rgba(20, 140, 20, 0.5)',
          target: 'rgba(20, 140, 20, 0.3)',
          inCheck: 'rgba(255, 0, 0, 0.65)',
        }
      }
    },
  },
  plugins: [],
}
