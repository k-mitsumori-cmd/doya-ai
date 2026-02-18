'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, X, RotateCcw, Check } from 'lucide-react'
import { getTemplateComponent } from './templates'

interface AnimationPreviewProps {
  isOpen: boolean
  onClose: () => void
  onSelect: () => void
  templateId: string
  templateName: string
  config: {
    colors: { primary: string; secondary: string; accent: string; background: string; text: string }
    texts: { headline: string; subtext: string; cta: string }
    logo: { url: string | null; base64: string | null; alt: string | null }
    timing: { duration: number; stagger: number; easing: string }
    showLogo: boolean
    showCTA: boolean
  }
}

export default function AnimationPreview({
  isOpen,
  onClose,
  onSelect,
  templateId,
  templateName,
  config,
}: AnimationPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [playKey, setPlayKey] = useState(0)

  const replay = useCallback(() => {
    setIsPlaying(false)
    setTimeout(() => {
      setPlayKey(k => k + 1)
      setIsPlaying(true)
    }, 100)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setIsPlaying(true)
      setSpeed(1)
      setPlayKey(k => k + 1)
    }
  }, [isOpen])

  if (!isOpen) return null

  const TemplateComponent = getTemplateComponent(templateId)

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-black" />

        {/* Header */}
        <div className="relative z-[110] flex items-center justify-between px-6 py-4">
          <h2 className="text-white font-bold">{templateName}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Animation Canvas - render actual template */}
        <div className="relative flex-1">
          {TemplateComponent && isPlaying ? (
            <TemplateComponent
              key={playKey}
              colors={config.colors}
              texts={config.texts}
              logo={config.logo}
              timing={{
                duration: config.timing.duration / speed,
                stagger: config.timing.stagger / speed,
                easing: config.timing.easing,
              }}
              showLogo={config.showLogo}
              showCTA={config.showCTA}
              isPlaying={true}
              onComplete={() => setIsPlaying(false)}
              containerMode="contained"
            />
          ) : !isPlaying ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={replay}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-[#EF4343]/90 text-white shadow-[0_0_20px_rgba(239,67,67,0.4)] hover:shadow-[0_0_30px_rgba(239,67,67,0.6)] transition-shadow"
              >
                <Play className="h-12 w-12 ml-1" />
              </button>
            </div>
          ) : null}
        </div>

        {/* Control Bar */}
        <div className="relative z-[110] px-6 pb-6">
          <div className="mx-auto max-w-2xl rounded-2xl border border-[#EF4343]/20 bg-[#221010]/70 backdrop-blur-[20px] px-6 py-4 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              {/* Playback controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => isPlaying ? setIsPlaying(false) : replay()}
                  className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button
                  onClick={replay}
                  className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>

              {/* Speed */}
              <div className="flex items-center gap-1">
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                      speed === s ? 'bg-[#EF4343] text-white' : 'bg-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Select button */}
              <motion.button
                onClick={onSelect}
                className="flex items-center gap-2 rounded-xl bg-[#EF4343] px-6 py-2.5 font-bold text-white shadow-lg shadow-[#EF4343]/20 hover:shadow-[#EF4343]/40 transition-shadow"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Check className="h-4 w-4" />
                選択する
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
