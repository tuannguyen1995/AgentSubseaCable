/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        abyss: {
          950: '#040914',
          900: '#071021',
          850: '#0A1526',
          800: '#0D1E36',
          700: '#142C4F',
          600: '#1E3E6B',
        },
        ocean: {
          cyan: '#06B6D4',
          electric: '#0EA5E9',
          glow: '#38BDF8',
        },
        seismic: {
          amber: '#F59E0B',
          flame: '#D97706',
          warning: '#FBBF24',
        },
        telecom: {
          emerald: '#10B981',
          green: '#059669',
          crimson: '#EF4444',
          danger: '#DC2626',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 25px -5px rgba(6, 182, 212, 0.35)',
        'amber-glow': '0 0 25px -5px rgba(245, 158, 11, 0.35)',
        'crimson-glow': '0 0 25px -5px rgba(239, 68, 68, 0.35)',
        'emerald-glow': '0 0 25px -5px rgba(16, 185, 129, 0.35)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.08)' },
        },
        waveScroll: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'wave-scroll': 'waveScroll 15s linear infinite',
      }
    },
  },
  plugins: [],
}
