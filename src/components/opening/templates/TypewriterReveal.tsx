'use client'

import { motion } from 'framer-motion'
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

export default function TypewriterReveal({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  const [displayedChars, setDisplayedChars] = useState(0)
  const [showSubtext, setShowSubtext] = useState(false)
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    if (!isPlaying) return
    const total = texts.headline.length
    const charDelay = (timing.duration * 0.5 * 1000) / total
    const startDelay = timing.duration * 0.2 * 1000

    const startTimer = setTimeout(() => {
      let i = 0
      const interval = setInterval(() => {
        i++
        setDisplayedChars(i)
        if (i >= total) {
          clearInterval(interval)
          setTimeout(() => setShowSubtext(true), 400)
          setTimeout(() => setShowCursor(false), 800)
        }
      }, charDelay)
      return () => clearInterval(interval)
    }, startDelay)

    const completeTimer = setTimeout(() => onComplete?.(), timing.duration * 1000)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(completeTimer)
    }
  }, [isPlaying, timing.duration, texts.headline, onComplete])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex flex-col items-center justify-center`}
      style={{ backgroundColor: colors.background }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Decorative top line */}
      <motion.div
        className="absolute top-[20%] h-px w-0"
        style={{ backgroundColor: colors.accent }}
        animate={{ width: '60%' }}
        transition={{ duration: timing.duration * 0.3, delay: 0.1 }}
      />

      {showLogo && logo.url && (
        <motion.img
          src={logo.url}
          alt={logo.alt || ''}
          className="h-12 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
      )}

      {/* Typewriter headline */}
      <div className="text-4xl md:text-6xl font-black text-center mb-4 font-mono">
        <span style={{ color: colors.primary }}>
          {texts.headline.slice(0, displayedChars)}
        </span>
        {showCursor && (
          <motion.span
            style={{ color: colors.accent }}
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            |
          </motion.span>
        )}
      </div>

      {/* Subtext fade in */}
      <motion.p
        className="text-lg text-center max-w-lg"
        style={{ color: colors.text, opacity: 0 }}
        animate={showSubtext ? { opacity: 0.6 } : {}}
        transition={{ duration: 0.6 }}
      >
        {texts.subtext}
      </motion.p>

      {showCTA && (
        <motion.button
          className="mt-8 px-8 py-3 rounded-xl font-bold text-white"
          style={{ backgroundColor: colors.accent }}
          initial={{ opacity: 0, y: 20 }}
          animate={showSubtext ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          {texts.cta}
        </motion.button>
      )}

      {/* Decorative bottom line */}
      <motion.div
        className="absolute bottom-[20%] h-px w-0"
        style={{ backgroundColor: colors.accent }}
        animate={{ width: '40%' }}
        transition={{ duration: timing.duration * 0.4, delay: timing.duration * 0.5 }}
      />
    </motion.div>
  )
}
