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

export default function GradientWipe({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} overflow-hidden`}
      style={{ backgroundColor: colors.background }}
    >
      {/* Gradient wipe layer 1 - diagonal */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
        }}
        initial={{ clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
        animate={{
          clipPath: [
            'polygon(0 0, 0 0, 0 100%, 0 100%)',
            'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
            'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)',
          ],
        }}
        transition={{
          duration: timing.duration * 0.5,
          times: [0, 0.5, 1],
          ease: 'easeInOut',
        }}
      />

      {/* Gradient wipe layer 2 - accent */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(45deg, ${colors.accent}, ${colors.primary})`,
        }}
        initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
        animate={{
          clipPath: [
            'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)',
            'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
            'polygon(0 0, 0 0, 0 100%, 0 100%)',
          ],
        }}
        transition={{
          duration: timing.duration * 0.5,
          delay: timing.duration * 0.2,
          times: [0, 0.5, 1],
          ease: 'easeInOut',
        }}
      />

      {/* Content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {showLogo && logo.url && (
          <motion.img
            src={logo.url}
            alt={logo.alt || ''}
            className="h-14 mb-8"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: timing.duration * 0.35 }}
          />
        )}

        {/* Headline with clip reveal */}
        <motion.h1
          className="text-5xl md:text-7xl font-black text-center mb-4"
          style={{ color: colors.primary }}
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: 0.8, delay: timing.duration * 0.4, ease: 'easeOut' }}
        >
          {texts.headline}
        </motion.h1>

        {/* Subtext slides up */}
        <motion.p
          className="text-xl text-center max-w-lg"
          style={{ color: colors.text }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 0.6, y: 0 }}
          transition={{ duration: 0.6, delay: timing.duration * 0.55 }}
        >
          {texts.subtext}
        </motion.p>

        {showCTA && (
          <motion.button
            className="mt-8 px-8 py-3 rounded-xl font-bold"
            style={{
              backgroundColor: 'transparent',
              border: `2px solid ${colors.primary}`,
              color: colors.primary,
            }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: timing.duration * 0.7, type: 'spring' }}
          >
            {texts.cta}
          </motion.button>
        )}
      </div>

      {/* Bottom accent stripe */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent}, ${colors.secondary})` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: timing.duration * 0.3, delay: timing.duration * 0.6 }}
        />
    </motion.div>
  )
}
