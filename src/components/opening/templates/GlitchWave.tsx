'use client'

import { motion } from 'framer-motion'
import { useEffect, useMemo } from 'react'

interface TemplateProps {
  colors: { primary: string; secondary: string; accent: string; background: string; text: string }
  texts: { headline: string; subtext: string; cta: string }
  logo: { url: string | null; base64: string | null; alt: string | null }
  timing: { duration: number; stagger: number; easing: string }
  showLogo: boolean
  showCTA: boolean
  isPlaying: boolean
  onComplete?: () => void
  containerMode?: 'fullscreen' | 'contained'
}

export default function GlitchWave({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  const chars = useMemo(() => texts.headline.split(''), [texts.headline])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex flex-col items-center justify-center overflow-hidden`}
      style={{ backgroundColor: colors.background }}
    >
      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${colors.primary}08 2px, ${colors.primary}08 4px)`,
      }} />

      {/* Horizontal glitch bars */}
      {[0.15, 0.35, 0.6].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute left-0 right-0 h-1"
          style={{
            top: `${25 + i * 25}%`,
            backgroundColor: i % 2 === 0 ? colors.primary : colors.accent,
            opacity: 0.6,
          }}
          initial={{ scaleX: 0, x: '-50%' }}
          animate={{ scaleX: [0, 1, 1, 0], x: ['-50%', '0%', '0%', '50%'], opacity: [0, 0.6, 0.6, 0] }}
          transition={{ duration: 0.4, delay: timing.duration * delay }}
        />
      ))}

      {showLogo && logo.url && (
        <motion.img
          src={logo.url}
          alt={logo.alt || ''}
          className="h-14 mb-8"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: [0, 1, 1, 0.8, 1], x: [-30, 5, -3, 1, 0] }}
          transition={{ duration: 0.8, delay: timing.duration * 0.2 }}
        />
      )}

      {/* Glitch headline - each char waves independently */}
      <div className="flex flex-wrap justify-center text-4xl md:text-7xl font-black mb-4">
        {chars.map((char, i) => (
          <motion.span
            key={i}
            style={{ color: colors.primary, display: 'inline-block' }}
            initial={{ opacity: 0, y: 40, rotateX: -90 }}
            animate={{
              opacity: 1,
              y: [40, -5, 2, 0],
              rotateX: [-90, 5, -2, 0],
            }}
            transition={{
              duration: 0.6,
              delay: timing.duration * 0.25 + i * timing.stagger * 0.3,
              times: [0, 0.6, 0.8, 1],
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </div>

      {/* RGB split effect on subtext */}
      <div className="relative">
        <motion.p
          className="text-xl text-center max-w-lg absolute"
          style={{ color: colors.accent, mixBlendMode: 'screen' }}
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: [0, 0.4, 0], x: [4, 2, 0] }}
          transition={{ duration: 0.8, delay: timing.duration * 0.55 }}
        >
          {texts.subtext}
        </motion.p>
        <motion.p
          className="text-xl text-center max-w-lg"
          style={{ color: colors.text }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ duration: 0.6, delay: timing.duration * 0.55 }}
        >
          {texts.subtext}
        </motion.p>
      </div>

      {showCTA && (
        <motion.button
          className="mt-8 px-8 py-3 rounded-xl font-bold text-white border-2"
          style={{ backgroundColor: 'transparent', borderColor: colors.accent, color: colors.accent }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: timing.duration * 0.7 }}
        >
          {texts.cta}
        </motion.button>
      )}
    </motion.div>
  )
}
