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

export default function CinematicReveal({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex items-center justify-center bg-black`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Light beam */}
      <motion.div
        className="absolute h-[2px] left-0 right-0 top-1/2"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)` }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0] }}
        transition={{ duration: timing.duration * 0.3, times: [0, 0.5, 1] }}
      />

      {/* Curtain top */}
      <motion.div
        className="absolute top-0 left-0 right-0 bg-black"
        initial={{ height: '50%' }}
        animate={{ height: '0%' }}
        transition={{ delay: timing.duration * 0.2, duration: timing.duration * 0.3 }}
      />
      {/* Curtain bottom */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-black"
        initial={{ height: '50%' }}
        animate={{ height: '0%' }}
        transition={{ delay: timing.duration * 0.2, duration: timing.duration * 0.3 }}
      />

      {/* Background transition */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: colors.background }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: timing.duration * 0.4, duration: timing.duration * 0.3 }}
      />

      {/* Content */}
      <div className="relative z-10 text-center">
        {showLogo && logo.url && (
          <motion.img
            src={logo.url}
            alt={logo.alt || ''}
            className="h-20 mx-auto mb-6"
            style={{ filter: `drop-shadow(0 0 20px ${colors.primary})` }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: timing.duration * 0.35, duration: 0.8 }}
          />
        )}
        <motion.h1
          className="text-5xl md:text-8xl font-black mb-4"
          style={{ color: colors.primary }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: timing.duration * 0.45, duration: 0.6 }}
        >
          {texts.headline}
        </motion.h1>
        <motion.p
          className="text-lg max-w-lg mx-auto"
          style={{ color: colors.text, opacity: 0.5 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.5, y: 0 }}
          transition={{ delay: timing.duration * 0.6, duration: 0.5 }}
        >
          {texts.subtext}
        </motion.p>
      </div>
    </motion.div>
  )
}
