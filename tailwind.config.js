/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Rubik', 'sans-serif'],
        body: ['Nunito Sans', 'sans-serif'],
        sans: ['Nunito Sans', 'sans-serif']
      },
      colors: {
        primary: {
          DEFAULT: '#0F172A',
          foreground: '#FFFFFF'
        },
        secondary: {
          DEFAULT: '#1E293B',
          foreground: '#FFFFFF'
        },
        accent: {
          DEFAULT: '#22C55E',
          foreground: '#0F172A',
          blue: '#0369A1'
        },
        background: '#020617',
        foreground: '#F8FAFC',
        card: {
          DEFAULT: '#0E1223',
          foreground: '#F8FAFC'
        },
        muted: {
          DEFAULT: '#1A1E2F',
          foreground: '#94A3B8'
        },
        border: '#334155',
        input: '#1E293B',
        ring: '#22C55E',
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF'
        },
        success: {
          DEFAULT: '#22C55E',
          foreground: '#0F172A'
        },
        warning: {
          DEFAULT: '#F59E0B',
          foreground: '#0F172A'
        }
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem'
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' }
        }
      }
    }
  },
  plugins: []
}
