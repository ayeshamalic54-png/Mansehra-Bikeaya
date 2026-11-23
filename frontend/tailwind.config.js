/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          green: '#00A651',
          greenDark: '#008E46',
          magenta: '#EC1FA8',
          teal: '#14B8A6',
          mist: '#F4F6FB',
          cloud: '#EEF1F7',
        },
      },
    },
  },
  plugins: [],
}
