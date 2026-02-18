'use client'

import { motion } from 'framer-motion'
import { Play, Lock } from 'lucide-react'
import MiniPreview from './MiniPreview'

interface AnimationCardProps {
  templateId: string
  name: string
  nameEn: string
  description: string
  isPro: boolean
  isLocked: boolean
  colors: { primary: string; secondary: string; background: string }
  onPreview: () => void
  onSelect: () => void
}

export default function AnimationCard({
  templateId,
  name,
  nameEn,
  description,
  isPro,
  isLocked,
  colors,
  onPreview,
  onSelect,
}: AnimationCardProps) {
  return (
    <motion.div
      className={`group relative flex flex-col gap-4 p-1 border rounded-xl transition-all duration-300 ${
        isLocked
          ? 'border-white/5 bg-white/5 cursor-not-allowed'
          : 'border-white/5 bg-white/5 hover:border-[#EF4343] hover:shadow-[0_0_20px_rgba(239,67,67,0.3)]'
      }`}
      whileHover={isLocked ? {} : { y: -4 }}
    >
      {/* Preview area */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {/* Template-specific mini animation preview */}
        <div className={`absolute inset-0 ${isLocked ? 'blur-[4px] grayscale-[0.5]' : ''}`}>
          <MiniPreview templateId={templateId} colors={colors} nameEn={nameEn} />
        </div>

        {/* Hover overlay */}
        {!isLocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <motion.button
              onClick={(e) => { e.stopPropagation(); onPreview() }}
              className="bg-[#EF4343] text-white px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Play className="h-4 w-4" />
              プレビュー
            </motion.button>
          </div>
        )}

        {/* PRO Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-[#120808]/60 backdrop-blur-[8px] flex flex-col items-center justify-center text-white p-4 text-center">
            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center mb-2">
              <Lock className="h-5 w-5 text-[#EF4343]" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-[#EF4343] mb-1">
              PRO Feature
            </span>
            <span className="text-xs text-white/50">プロプランでアンロック</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-white text-lg font-bold">{name}</h3>
          {isPro && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EF4343]/20 text-[#EF4343] px-2 py-0.5 rounded-full">
              PRO
            </span>
          )}
        </div>
        <p className="text-white/50 text-sm leading-relaxed">{description}</p>
        {!isLocked && (
          <button
            onClick={onSelect}
            className="mt-3 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors"
          >
            このテンプレートを選ぶ
          </button>
        )}
      </div>
    </motion.div>
  )
}
