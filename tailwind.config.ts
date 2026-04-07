import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors
        brand: {
          blue: '#3B82F6',
          purple: '#8B5CF6',
          pink: '#EC4899',
        },
        // Slate (Dark theme base)
        slate: {
          950: '#020617',
        },
        // LP Design System (Stitch)
        lp: {
          bg: '#0f2023',
          surface: '#183035',
          border: '#21444a',
          primary: '#05b7d6',
        },
        // Border
        border: 'hsl(var(--border, 240 3.7% 15.9%))',
        // 三ツ星アプリシリーズ（toCブランド、ドヤAIとは独立）
        mitsuboshi: {
          midnight: '#0B0E24',
          indigo: '#161B3A',
          twilight: '#232851',
          champagne: '#E8C766',
          'champagne-light': '#F5E5B8',
          platinum: '#D4D8F0',
          moon: '#F5F3E8',
          mist: '#9098B8',
          fog: '#4A5070',
          sakura: '#E8A0BF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Inter', 'Noto Sans JP', 'sans-serif'],
        mitsuboshi: [
          'var(--font-mitsuboshi-en)',
          'var(--font-mitsuboshi-jp)',
          '"Hiragino Mincho ProN"',
          '"YuMincho"',
          '"Noto Serif JP"',
          '"Noto Sans JP"',
          'serif',
        ],
      },
      fontSize: {
        'display-lg': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-sm': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow-sm': '0 0 20px rgba(59, 130, 246, 0.2)',
        'glow-md': '0 0 40px rgba(59, 130, 246, 0.3)',
        'glow-lg': '0 0 60px rgba(59, 130, 246, 0.4)',
        'glow-purple': '0 0 40px rgba(139, 92, 246, 0.3)',
        'glow-pink': '0 0 40px rgba(236, 72, 153, 0.3)',
        'glow-cyan': '0 0 20px rgba(5, 183, 214, 0.3)',
        'glow-cyan-lg': '0 0 40px -10px rgba(5, 183, 214, 0.3)',
        'glow-champagne': '0 0 24px rgba(232, 199, 102, 0.45)',
        'glow-champagne-lg': '0 0 48px rgba(232, 199, 102, 0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'spin-slow': 'spin 8s linear infinite',
        'star-twinkle': 'starTwinkle 4s ease-in-out infinite',
        'star-ignite': 'starIgnite 0.9s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(59, 130, 246, 0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        starTwinkle: {
          '0%, 100%': { opacity: '0.85', filter: 'drop-shadow(0 0 4px rgba(232,199,102,0.5))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 12px rgba(232,199,102,0.9))' },
        },
        starIgnite: {
          '0%': { opacity: '0', transform: 'scale(0.6)', filter: 'drop-shadow(0 0 0 rgba(232,199,102,0))' },
          '60%': { opacity: '1', transform: 'scale(1.25)', filter: 'drop-shadow(0 0 18px rgba(232,199,102,0.9))' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'drop-shadow(0 0 8px rgba(232,199,102,0.6))' },
        },
        progressGrow: {
          '0%': { width: '5%' },
          '15%': { width: '15%' },
          '30%': { width: '30%' },
          '50%': { width: '50%' },
          '65%': { width: '65%' },
          '80%': { width: '78%' },
          '100%': { width: '90%' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'grid-pattern': `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
        'dots-pattern': 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '64px 64px',
        'dots': '32px 32px',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}

export default config
