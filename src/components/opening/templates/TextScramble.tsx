'use client'

import { motion } from 'framer-motion'
import { useEffect, useState, useCallback } from 'react'

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

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*アイウエオカキクケコ'

function useScrambleText(target: string, isActive: boolean, duration: number) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (!isActive) { setDisplay(''); return }
    const len = target.length
    const totalFrames = Math.max(len * 4, 30)
    const frameTime = (duration * 1000) / totalFrames
    let frame = 0

    const interval = setInterval(() => {
      frame++
      const progress = frame / totalFrames
      const revealed = Math.floor(progress * len)
      let result = ''
      for (let i = 0; i < len; i++) {
        if (i < revealed) {
          result += target[i]
        } else if (target[i] === ' ') {
          result += ' '
        } else {
          result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        }
      }
      setDisplay(result)
      if (frame >= totalFrames) {
        clearInterval(interval)
        setDisplay(target)
      }
    }, frameTime)
    return () => clearInterval(interval)
  }, [target, isActive, duration])

  return display
}

export default function TextScramble({ colors, texts, logo, timing, showLogo, showCTA, isPlaying, onComplete, containerMode = 'fullscreen' }: TemplateProps) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!isPlaying) return
    const t1 = setTimeout(() => setPhase(1), timing.duration * 0.15 * 1000)
    const t2 = setTimeout(() => setPhase(2), timing.duration * 0.5 * 1000)
    const t3 = setTimeout(() => onComplete?.(), timing.duration * 1000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [isPlaying, timing.duration, onComplete])

  const scrambledHeadline = useScrambleText(texts.headline, phase >= 1, timing.duration * 0.3)
  const scrambledSubtext = useScrambleText(texts.subtext, phase >= 2, timing.duration * 0.2)

  if (!isPlaying) return null

  return (
    <motion.div
      className={`${containerMode === 'contained' ? 'absolute inset-0' : 'fixed inset-0 z-50'} flex flex-col items-center justify-center overflow-hidden`}
      style={{ backgroundColor: colors.background }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Matrix-like falling dots */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-px"
          style={{
            left: `${5 + (i * 4.5)}%`,
            height: '15%',
            background: `linear-gradient(to bottom, transparent, ${colors.primary}40, transparent)`,
          }}
          initial={{ top: '-15%', opacity: 0 }}
          animate={{ top: '115%', opacity: [0, 0.4, 0] }}
          transition={{
            duration: 1.5 + Math.random(),
            delay: Math.random() * timing.duration * 0.5,
            repeat: 0,
          }}
        />
      ))}

      {showLogo && logo.url && (
        <motion.img
          src={logo.url}
          alt={logo.alt || ''}
          className="h-14 mb-8"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: timing.duration * 0.1 }}
        />
      )}

      {/* Scrambling headline */}
      <div className="text-4xl md:text-6xl font-black text-center mb-4 font-mono tracking-wider">
        <span style={{ color: colors.primary }}>{scrambledHeadline}</span>
      </div>

      {/* Scrambling subtext */}
      <div className="text-lg text-center max-w-lg font-mono">
        <span style={{ color: colors.text, opacity: 0.6 }}>{scrambledSubtext}</span>
      </div>

      {/* Accent line that reveals */}
      <motion.div
        className="mt-6 h-0.5 bg-gradient-to-r"
        style={{ background: `linear-gradient(to right, transparent, ${colors.accent}, transparent)` }}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 200, opacity: 1 }}
        transition={{ duration: 0.8, delay: timing.duration * 0.55 }}
      />

      {showCTA && (
        <motion.button
          className="mt-8 px-8 py-3 rounded-xl font-bold font-mono tracking-wider"
          style={{ backgroundColor: colors.accent, color: colors.background }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: timing.duration * 0.7 }}
        >
          {texts.cta}
        </motion.button>
      )}
    </motion.div>
  )
}
