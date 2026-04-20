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
        // Border
        border: 'hsl(var(--border, 240 3.7% 15.9%))',
        // ドヤマーケAI（オールインワン・マーケティングAI）
        allinone: {
          bg: '#FFFFFF',
          surface: '#F7F8FC',
          card: '#FBFBFE',
          border: '#E6E8F0',
          line: '#EEF0F8',
          ink: '#0B0E24',
          inkSoft: '#1E2240',
          muted: '#6B7280',
          mutedSoft: '#9CA3AF',
          primary: '#7C5CFF',
          primaryDeep: '#5C3BEA',
          primarySoft: '#F0ECFF',
          accent: '#00E5A0',
          accentSoft: '#DCFCE7',
          cyan: '#22D3EE',
          warn: '#FFB547',
          warnSoft: '#FFF3DB',
          danger: '#FF5C7C',
          dangerSoft: '#FFE4EB',
          glow: '#B9A8FF',
          grad1: '#7C5CFF',
          grad2: '#22D3EE',
          grad3: '#00E5A0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Inter', 'Noto Sans JP', 'sans-serif'],
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
      },
      animation: {
        'allinone-beam': 'allinoneBeam 1.8s ease-out forwards',
        'allinone-orbit': 'allinoneOrbit 18s linear infinite',
        'allinone-orbit-reverse': 'allinoneOrbit 22s linear infinite reverse',
        'allinone-rise': 'allinoneRise 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'allinone-pop': 'allinonePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'allinone-ping-slow': 'allinonePing 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'allinone-zoom': 'allinoneZoom 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'allinone-byun': 'allinoneByun 0.9s cubic-bezier(0.2, 1.2, 0.3, 1) forwards',
        'allinone-float-sm': 'allinoneFloatSm 6s ease-in-out infinite',
        'allinone-float-lg': 'allinoneFloatLg 9s ease-in-out infinite',
        'allinone-sheen': 'allinoneSheen 2.4s linear infinite',
        'allinone-count': 'allinoneCount 1.4s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        allinoneBeam: {
          '0%': { opacity: '0', transform: 'scaleY(0) translateY(-50%)' },
          '30%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'scaleY(1) translateY(60%)' },
        },
        allinoneOrbit: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        allinoneRise: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        allinonePop: {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        allinonePing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '80%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        allinoneZoom: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        allinoneByun: {
          '0%': { opacity: '0', transform: 'translateX(120%) scale(0.7)', filter: 'blur(16px)' },
          '55%': { opacity: '1', transform: 'translateX(-6%) scale(1.08)', filter: 'blur(0)' },
          '80%': { transform: 'translateX(2%) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        allinoneFloatSm: {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-10px) rotate(2deg)' },
        },
        allinoneFloatLg: {
          '0%, 100%': { transform: 'translateY(0) rotate(2deg)' },
          '50%': { transform: 'translateY(-18px) rotate(-2deg)' },
        },
        allinoneSheen: {
          '0%': { backgroundPosition: '-150% 0' },
          '100%': { backgroundPosition: '250% 0' },
        },
        allinoneCount: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
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
