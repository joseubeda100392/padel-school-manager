import type { Config } from 'tailwindcss'

// Tokens semánticos del sistema de diseño (design.md). Los colores de marca
// `brand` y `court` se mantienen mientras se migran las pantallas antiguas.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

type FontSizeToken = [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }]

const fontSize: Record<string, FontSizeToken> = {
  display: ['2rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em', fontWeight: '600' }],
  title: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em', fontWeight: '600' }],
  heading: ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '600' }],
  body: ['0.9375rem', { lineHeight: '1.375rem' }],
  label: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
  meta: ['0.8125rem', { lineHeight: '1.125rem' }],
}

const designTokens = {
  borderRadius: {
    control: '10px',
    card: '14px',
    sheet: '20px',
  },
  boxShadow: {
    card: '0 1px 2px rgb(14 28 44 / 0.04), 0 0 0 1px rgb(14 28 44 / 0.02)',
    overlay: '0 12px 32px -8px rgb(14 28 44 / 0.22), 0 2px 6px rgb(14 28 44 / 0.08)',
  },
  transitionTimingFunction: {
    out: 'var(--ease-out)',
    drawer: 'var(--ease-drawer)',
  },
  fontSize,
  spacing: {
    'tabbar': 'var(--tabbar-h)',
  },
}

const config: Config = {
  // En móvil el :hover se queda pegado tras tocar; así solo aplica con ratón.
  future: { hoverOnlyWhenSupported: true },
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          ink: token('accent-ink'),
          soft: token('accent-soft'),
          on: token('on-accent'),
        },
        warn: { ink: token('warn-ink'), soft: token('warn-soft') },
        danger: { ink: token('danger-ink'), soft: token('danger-soft') },
        chrome: {
          DEFAULT: token('chrome'),
          2: token('chrome-2'),
          line: token('chrome-line'),
          ink: token('chrome-ink'),
          'ink-2': token('chrome-ink-2'),
        },
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
      ...designTokens,
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
