import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        aurora: '#0969DA',
        cyanMist: '#DDFBFF',
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.5rem' }],
        base: ['1rem', { lineHeight: '1.625rem' }],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.06)',
      },
      keyframes: {
        // Light sweeping across the progress bar, suggesting an active read.
        scan: {
          '0%': { transform: 'translateX(-110%)' },
          '100%': { transform: 'translateX(420%)' },
        },
        caret: {
          '0%, 45%': { opacity: '1' },
          '50%, 95%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(3px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.82)' },
        },
      },
      animation: {
        scan: 'scan 1.9s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        caret: 'caret 1.05s steps(1, end) infinite',
        riseIn: 'riseIn 220ms ease-out both',
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
