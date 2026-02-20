'use client'

import { motion } from 'framer-motion'
import { useEffect } from 'react'

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

export default function ZoomRotate({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex items-center justify-center overflow-hidden`}
      style={{ backgroundColor: colors.background }}
    >
      {/* Expanding background circles */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            border: `2px solid ${i === 0 ? colors.primary : i === 1 ? colors.secondary : colors.accent}`,
            opacity: 0,
          }}
          initial={{ width: 0, height: 0, opacity: 0 }}
          animate={{
            width: ['0vw', '150vw'],
            height: ['0vw', '150vw'],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: timing.duration * 0.6,
            delay: timing.duration * 0.05 + i * 0.15,
            times: [0, 0.4, 1],
          }}
        />
      ))}

      {/* Rotating frame */}
      <motion.div
        className="absolute border-2 rounded-2xl"
        style={{ borderColor: colors.accent, width: '70%', height: '50%', opacity: 0 }}
        initial={{ rotate: -15, scale: 0.5, opacity: 0 }}
        animate={{ rotate: [15, 0], scale: [0.5, 1], opacity: [0, 0.2, 0.2, 0] }}
        transition={{ duration: timing.duration * 0.7, times: [0, 0.3, 0.7, 1] }}
      />

      {/* Content zooms in with slight rotation */}
      <div className="relative z-10 text-center">
        {showLogo && logo.url && (
          <motion.img
            src={logo.url}
            alt={logo.alt || ''}
            className="h-16 mx-auto mb-8"
            initial={{ opacity: 0, scale: 3, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: timing.duration * 0.15, type: 'spring', damping: 15 }}
          />
        )}

        <motion.h1
          className="text-5xl md:text-7xl font-black mb-4"
          style={{ color: colors.primary }}
          initial={{ opacity: 0, scale: 5, rotate: -5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.9, delay: timing.duration * 0.2, type: 'spring', damping: 12 }}
        >
          {texts.headline}
        </motion.h1>

        <motion.p
          className="text-xl max-w-lg mx-auto"
          style={{ color: colors.text, opacity: 0 }}
          initial={{ opacity: 0, scale: 2 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ duration: 0.6, delay: timing.duration * 0.45 }}
        >
          {texts.subtext}
        </motion.p>

        {showCTA && (
          <motion.button
            className="mt-8 px-8 py-3 rounded-full font-bold text-white"
            style={{ backgroundColor: colors.accent }}
            initial={{ opacity: 0, scale: 0, rotate: 180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: timing.duration * 0.6, type: 'spring', damping: 10 }}
          >
            {texts.cta}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
