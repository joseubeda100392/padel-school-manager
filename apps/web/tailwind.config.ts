import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf8',
          100: '#ccfbef',
          200: '#99f6e0',
          400: '#2dd4b0',
          500: '#00c49a',
          600: '#00a882',
          700: '#00896a',
          900: '#065f46',
        },
        court: {
          900: '#0e1c2c',
          800: '#152434',
          700: '#1e3352',
          600: '#253d5a',
          500: '#2f5373',
          400: '#4a6a88',
          300: '#6a849a',
          200: '#8fa3b8',
          100: '#b8c8d8',
          50:  '#f0f4f8',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
