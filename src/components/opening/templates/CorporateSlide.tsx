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

export default function CorporateSlide({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex items-center justify-center`}
      style={{ backgroundColor: colors.background }}
    >
      {/* Sliding bar */}
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{ backgroundColor: colors.primary }}
        initial={{ width: '0%' }}
        animate={{ width: ['0%', '100%', '0%'] }}
        transition={{ duration: timing.duration * 0.5, times: [0, 0.5, 1], ease: 'easeInOut' }}
      />

      {/* Secondary bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ backgroundColor: colors.secondary }}
        initial={{ scaleX: 0, transformOrigin: 'left' }}
        animate={{ scaleX: 1 }}
        transition={{ delay: timing.duration * 0.4, duration: timing.duration * 0.3 }}
      />

      {/* Accent line */}
      <motion.div
        className="absolute top-1/3 left-0 right-0 h-px"
        style={{ backgroundColor: colors.accent }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: timing.duration * 0.5, duration: timing.duration * 0.2 }}
      />

      {/* Content */}
      <div className="relative z-10 text-center">
        {showLogo && logo.url && (
          <motion.img
            src={logo.url}
            alt={logo.alt || ''}
            className="h-14 mx-auto mb-8"
            initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
            transition={{ delay: timing.duration * 0.3, duration: 0.6 }}
          />
        )}
        <motion.h1
          className="text-4xl md:text-6xl font-black mb-3 tracking-tight"
          style={{ color: colors.primary }}
          initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
          transition={{ delay: timing.duration * 0.4, duration: 0.5 }}
        >
          {texts.headline}
        </motion.h1>
        <motion.p
          className="text-lg tracking-wide"
          style={{ color: colors.text, opacity: 0.5 }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 0.5, y: 0 }}
          transition={{ delay: timing.duration * 0.55, duration: 0.4 }}
        >
          {texts.subtext}
        </motion.p>
      </div>
    </motion.div>
  )
}
