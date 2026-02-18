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

export default function ParticleBurst({ colors, texts, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  const particles = useMemo(() => {
    const particleColors = [colors.primary, colors.secondary, colors.accent, '#FFD700']
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      size: Math.random() * 8 + 4,
      color: particleColors[i % particleColors.length],
      delay: Math.random() * 0.5,
    }))
  }, [colors])

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex items-center justify-center`}
      style={{ backgroundColor: colors.background }}
    >
      {/* Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{
            x: `${p.x}vw`,
            y: `${p.y}vh`,
            opacity: 0,
            scale: 0,
          }}
          animate={{
            x: ['0vw', `${p.x * 0.3}vw`, '0vw'],
            y: ['0vh', `${p.y * 0.3}vh`, '0vh'],
            opacity: [0, 1, 0.3],
            scale: [0, 1.5, 0.5],
          }}
          transition={{
            duration: timing.duration * 0.6,
            delay: p.delay,
            times: [0, 0.4, 1],
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 text-center">
        <motion.h1
          className="text-5xl md:text-7xl font-black mb-4"
          style={{ color: colors.primary }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: timing.duration * 0.35, type: 'spring', damping: 12 }}
        >
          {texts.headline.split('').map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: timing.duration * 0.4 + i * 0.03 }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>
        <motion.p
          className="text-xl"
          style={{ color: colors.text, opacity: 0.6 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: timing.duration * 0.6 }}
        >
          {texts.subtext}
        </motion.p>
        {showCTA && (
          <motion.button
            className="mt-8 px-8 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: colors.accent }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: timing.duration * 0.75, type: 'spring' }}
          >
            {texts.cta}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
