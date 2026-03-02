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

export default function DynamicSplit({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
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
      {/* Left panel */}
      <motion.div
        className="absolute inset-y-0 left-0 w-1/2"
        style={{ backgroundColor: colors.primary }}
        initial={{ x: '100%' }}
        animate={{ x: ['-100%', '0%', '-100%'] }}
        transition={{ duration: timing.duration * 0.6, times: [0, 0.4, 1] }}
      />
      {/* Right panel */}
      <motion.div
        className="absolute inset-y-0 right-0 w-1/2"
        style={{ backgroundColor: colors.secondary }}
        initial={{ x: '-100%' }}
        animate={{ x: ['100%', '0%', '100%'] }}
        transition={{ duration: timing.duration * 0.6, times: [0, 0.4, 1] }}
      />

      {/* Content */}
      <div className="relative z-10 text-center">
        {showLogo && logo.url && (
          <motion.img
            src={logo.url}
            alt={logo.alt || ''}
            className="h-16 mx-auto mb-8"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: timing.duration * 0.35, type: 'spring' }}
          />
        )}
        <motion.h1
          className="text-5xl md:text-7xl font-black mb-4"
          style={{ color: colors.primary }}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: timing.duration * 0.4, duration: 0.5 }}
        >
          {texts.headline}
        </motion.h1>
        <motion.p
          className="text-xl"
          style={{ color: colors.text, opacity: 0.6 }}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 0.6, x: 0 }}
          transition={{ delay: timing.duration * 0.5, duration: 0.5 }}
        >
          {texts.subtext}
        </motion.p>
        {showCTA && (
          <motion.button
            className="mt-8 px-8 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: colors.accent }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: timing.duration * 0.65 }}
          >
            {texts.cta}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
