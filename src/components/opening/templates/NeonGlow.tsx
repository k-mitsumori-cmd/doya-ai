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

export default function NeonGlow({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(() => onComplete?.(), timing.duration * 1000)
      return () => clearTimeout(t)
    }
  }, [isPlaying, timing.duration, onComplete])

  if (!isPlaying) return null

  const neonShadow = (color: string) => `0 0 7px ${color}, 0 0 10px ${color}, 0 0 21px ${color}, 0 0 42px ${color}`
  const neonShadowSm = (color: string) => `0 0 5px ${color}, 0 0 10px ${color}`

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex flex-col items-center justify-center overflow-hidden`}
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Grid background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(${colors.primary}08 1px, transparent 1px),
          linear-gradient(90deg, ${colors.primary}08 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
      }} />

      {/* Glow orbs */}
      <motion.div
        className="absolute w-64 h-64 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.primary}20, transparent 70%)`,
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-48 h-48 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.accent}15, transparent 70%)`,
          transform: 'translate(100px, -50px)',
        }}
        animate={{ scale: [1.2, 0.9, 1.2], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      {showLogo && logo.url && (
        <motion.img
          src={logo.url}
          alt={logo.alt || ''}
          className="h-14 mb-10"
          style={{ filter: `drop-shadow(${neonShadowSm(colors.primary)})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7, 1] }}
          transition={{ duration: 1.2, delay: timing.duration * 0.1 }}
        />
      )}

      {/* Neon headline - flickers on */}
      <motion.h1
        className="text-5xl md:text-7xl font-black text-center mb-4"
        style={{ color: colors.primary }}
        initial={{ opacity: 0, textShadow: 'none' }}
        animate={{
          opacity: [0, 0.3, 0, 0.7, 0.5, 1, 0.9, 1],
          textShadow: [
            'none',
            neonShadow(colors.primary),
            'none',
            neonShadow(colors.primary),
            'none',
            neonShadow(colors.primary),
            neonShadow(colors.primary),
            neonShadow(colors.primary),
          ],
        }}
        transition={{
          duration: 1.5,
          delay: timing.duration * 0.15,
          times: [0, 0.1, 0.15, 0.3, 0.35, 0.5, 0.7, 1],
        }}
      >
        {texts.headline}
      </motion.h1>

      {/* Neon underline */}
      <motion.div
        className="h-0.5 mb-6"
        style={{
          backgroundColor: colors.accent,
          boxShadow: neonShadowSm(colors.accent),
        }}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 180, opacity: [0, 1, 0.6, 1] }}
        transition={{ duration: 0.8, delay: timing.duration * 0.45 }}
      />

      {/* Subtext with glow */}
      <motion.p
        className="text-lg text-center max-w-lg"
        style={{ color: colors.text, textShadow: neonShadowSm(colors.secondary) }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8] }}
        transition={{ duration: 0.6, delay: timing.duration * 0.55 }}
      >
        {texts.subtext}
      </motion.p>

      {showCTA && (
        <motion.button
          className="mt-8 px-8 py-3 rounded-xl font-bold"
          style={{
            backgroundColor: 'transparent',
            border: `2px solid ${colors.accent}`,
            color: colors.accent,
            boxShadow: `${neonShadowSm(colors.accent)}, inset ${neonShadowSm(colors.accent)}`,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 1, 0.8, 1], scale: 1 }}
          transition={{ delay: timing.duration * 0.7, duration: 0.8 }}
        >
          {texts.cta}
        </motion.button>
      )}

      {/* Corner decorations */}
      {['top-8 left-8', 'top-8 right-8', 'bottom-8 left-8', 'bottom-8 right-8'].map((pos, i) => (
        <motion.div
          key={i}
          className={`absolute ${pos} w-8 h-8`}
          style={{
            borderTop: i < 2 ? `2px solid ${colors.primary}60` : 'none',
            borderBottom: i >= 2 ? `2px solid ${colors.primary}60` : 'none',
            borderLeft: i % 2 === 0 ? `2px solid ${colors.primary}60` : 'none',
            borderRight: i % 2 === 1 ? `2px solid ${colors.primary}60` : 'none',
            boxShadow: neonShadowSm(`${colors.primary}30`),
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: timing.duration * 0.3 + i * 0.1 }}
        />
      ))}
    </motion.div>
  )
}
