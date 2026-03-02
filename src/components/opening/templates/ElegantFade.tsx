'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

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

export default function ElegantFade({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex flex-col items-center justify-center`}
      style={{ backgroundColor: colors.background }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {showLogo && logo.url && (
        <motion.img
          src={logo.url}
          alt={logo.alt || ''}
          className="h-16 mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1, y: -20 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      )}
      <motion.h1
        className="text-5xl md:text-7xl font-black text-center mb-4"
        style={{ color: colors.primary }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 + timing.stagger }}
      >
        {texts.headline}
      </motion.h1>
      <motion.p
        className="text-xl text-center max-w-lg"
        style={{ color: colors.text, opacity: 0.6 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 0.6, delay: 1.0 + timing.stagger * 2 }}
      >
        {texts.subtext}
      </motion.p>
      {showCTA && (
        <motion.button
          className="mt-8 px-8 py-3 rounded-xl font-bold text-white"
          style={{ backgroundColor: colors.accent }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 1.5 + timing.stagger * 3 }}
        >
          {texts.cta}
        </motion.button>
      )}
    </motion.div>
  )
}
