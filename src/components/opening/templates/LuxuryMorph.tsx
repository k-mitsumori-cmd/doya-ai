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

export default function LuxuryMorph({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
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
      {/* Mesh gradient blobs */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-[120px]"
        style={{ backgroundColor: colors.primary, opacity: 0.15 }}
        animate={{
          x: [-100, 100, -100],
          y: [-50, 50, -50],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: timing.duration, repeat: 0 }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-[100px]"
        style={{ backgroundColor: colors.secondary, opacity: 0.1 }}
        animate={{
          x: [100, -100, 100],
          y: [50, -50, 50],
          scale: [1.1, 0.9, 1.1],
        }}
        transition={{ duration: timing.duration, repeat: 0 }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full blur-[80px]"
        style={{ backgroundColor: colors.accent, opacity: 0.08 }}
        animate={{
          x: [0, 80, 0],
          y: [80, 0, 80],
        }}
        transition={{ duration: timing.duration, repeat: 0 }}
      />

      {/* Content */}
      <div className="relative z-10 text-center">
        {showLogo && logo.url && (
          <motion.img
            src={logo.url}
            alt={logo.alt || ''}
            className="h-16 mx-auto mb-8"
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ delay: timing.duration * 0.2, duration: 0.8 }}
          />
        )}
        <motion.h1
          className="text-5xl md:text-7xl font-black mb-4"
          style={{ color: colors.primary }}
          initial={{ opacity: 0, letterSpacing: '0.5em' }}
          animate={{ opacity: 1, letterSpacing: '0em' }}
          transition={{ delay: timing.duration * 0.3, duration: 0.8, ease: 'easeOut' }}
        >
          {texts.headline}
        </motion.h1>
        <motion.p
          className="text-lg"
          style={{ color: colors.text, opacity: 0.5 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: timing.duration * 0.5, duration: 0.6 }}
        >
          {texts.subtext}
        </motion.p>

        {/* Decorative lines */}
        <div className="flex items-center justify-center mt-8 gap-4">
          <motion.div
            className="h-px w-24"
            style={{ background: `linear-gradient(to right, transparent, ${colors.accent})` }}
            initial={{ scaleX: 0, transformOrigin: 'right' }}
            animate={{ scaleX: 1 }}
            transition={{ delay: timing.duration * 0.55, duration: 0.5 }}
          />
          <motion.div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.accent }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: timing.duration * 0.6, type: 'spring' }}
          />
          <motion.div
            className="h-px w-24"
            style={{ background: `linear-gradient(to left, transparent, ${colors.accent})` }}
            initial={{ scaleX: 0, transformOrigin: 'left' }}
            animate={{ scaleX: 1 }}
            transition={{ delay: timing.duration * 0.55, duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  )
}
