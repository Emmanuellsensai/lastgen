/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'var(--lg-ink)',
          soft: 'var(--lg-ink-soft)',
          mute: 'var(--lg-ink-mute)',
        },
        cream: {
          DEFAULT: 'var(--lg-cream)',
          2: 'var(--lg-cream-2)',
          3: 'var(--lg-cream-3)',
        },
        gold: {
          DEFAULT: 'var(--lg-gold)',
          soft: 'var(--lg-gold-soft)',
        },
        green: {
          DEFAULT: 'var(--lg-green)',
          lift: 'var(--lg-green-lift)',
          soft: 'var(--lg-green-soft)',
        },
        burn: {
          DEFAULT: 'var(--lg-burn)',
          soft: 'var(--lg-burn-soft)',
        },
        line: {
          DEFAULT: 'var(--lg-line)',
          strong: 'var(--lg-line-strong)',
        },
        glass: 'var(--lg-glass-bg)',
      },
      borderRadius: {
        sm: 'var(--lg-r-sm)',
        md: 'var(--lg-r-md)',
        lg: 'var(--lg-r-lg)',
        full: 'var(--lg-r-full)',
      },
      boxShadow: {
        glass: 'var(--lg-glass-shadow)',
        'glass-1': 'var(--lg-glass-shadow-1)',
        'glass-2': 'var(--lg-glass-shadow-2)',
        'glass-3': 'var(--lg-glass-shadow-3)',
      },
      backdropBlur: {
        glass: 'var(--lg-glass-blur)',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Geist Sans"', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['15px', { lineHeight: '1.65' }],
      },
      transitionTimingFunction: {
        lg: 'var(--lg-ease)',
      },
      keyframes: {
        'lg-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'lg-pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.62' },
        },
        'lg-rise': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'lg-sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'lg-sheet-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'lg-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'lg-shimmer 1.8s linear infinite',
        'pulse-soft': 'lg-pulse-soft 2.4s var(--lg-ease) infinite',
        rise: 'lg-rise 240ms var(--lg-ease)',
        'sheet-up': 'lg-sheet-up 280ms var(--lg-ease)',
        'sheet-right': 'lg-sheet-right 280ms var(--lg-ease)',
        'fade-in': 'lg-fade-in 200ms var(--lg-ease)',
      },
    },
  },
  plugins: [],
};
