'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface MiniPreviewProps {
  templateId: string
  colors: { primary: string; secondary: string; background: string; accent?: string }
  nameEn: string
}

export default function MiniPreview({ templateId, colors, nameEn }: MiniPreviewProps) {
  switch (templateId) {
    case 'elegant-fade':
      return <ElegantFadeMini colors={colors} nameEn={nameEn} />
    case 'dynamic-split':
      return <DynamicSplitMini colors={colors} nameEn={nameEn} />
    case 'cinematic-reveal':
      return <CinematicRevealMini colors={colors} nameEn={nameEn} />
    case 'particle-burst':
      return <ParticleBurstMini colors={colors} nameEn={nameEn} />
    case 'corporate-slide':
      return <CorporateSlideMini colors={colors} nameEn={nameEn} />
    case 'luxury-morph':
      return <LuxuryMorphMini colors={colors} nameEn={nameEn} />
    default:
      return <DefaultMini colors={colors} nameEn={nameEn} />
  }
}

type MiniProps = { colors: MiniPreviewProps['colors']; nameEn: string }

/** 洗練フェードイン: 3段テキストが順次フェードイン */
function ElegantFadeMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: colors.background }}>
      <motion.div
        className="h-3 w-3 rounded-full mb-1"
        style={{ backgroundColor: colors.primary }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.2, 0.7, 1] }}
      />
      <motion.div
        className="text-base font-bold"
        style={{ color: colors.primary }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.35, 0.7, 1] }}
      >
        {nameEn}
      </motion.div>
      <motion.div
        className="h-px w-16"
        style={{ backgroundColor: colors.secondary }}
        animate={{ scaleX: [0, 0, 1, 1, 0], opacity: [0, 0, 0.5, 0.5, 0] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 0.5, 0.7, 1] }}
      />
    </div>
  )
}

/** ダイナミックスプリット: 左右パネルがスライド展開 */
function DynamicSplitMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: colors.background }}>
      <motion.div
        className="absolute inset-y-0 left-0 w-1/2"
        style={{ backgroundColor: colors.primary }}
        animate={{ x: ['-100%', '0%', '0%', '-100%'] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.25, 0.65, 1] }}
      />
      <motion.div
        className="absolute inset-y-0 right-0 w-1/2"
        style={{ backgroundColor: colors.secondary }}
        animate={{ x: ['100%', '0%', '0%', '100%'] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.25, 0.65, 1] }}
      />
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.span
          className="text-base font-bold px-2 text-center"
          style={{ color: colors.primary }}
          animate={{ opacity: [0, 0, 1, 1, 0], x: [-20, -20, 0, 0, 20] }}
          transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.2, 0.4, 0.7, 1] }}
        >
          {nameEn}
        </motion.span>
      </div>
    </div>
  )
}

/** シネマティックリビール: カーテンが開く＋光ビーム */
function CinematicRevealMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Light beam */}
      <motion.div
        className="absolute h-[1px] left-0 right-0 top-1/2"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)` }}
        animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 1, 0.5, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.2, 0.35, 0.5] }}
      />
      {/* Top curtain */}
      <motion.div
        className="absolute top-0 left-0 right-0 bg-black z-10"
        animate={{ height: ['50%', '50%', '0%', '0%', '50%'] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.15, 0.4, 0.75, 1] }}
      />
      {/* Bottom curtain */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-black z-10"
        animate={{ height: ['50%', '50%', '0%', '0%', '50%'] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.15, 0.4, 0.75, 1] }}
      />
      {/* Content behind curtain */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: colors.background }}>
        <span className="text-base font-bold" style={{ color: colors.primary }}>{nameEn}</span>
      </div>
    </div>
  )
}

/** パーティクルバースト: ドットが集まる＋文字出現 */
function ParticleBurstMini({ colors, nameEn }: MiniProps) {
  const particles = useMemo(() => {
    const cs = [colors.primary, colors.secondary, colors.accent || '#FFD700']
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 150,
      y: (Math.random() - 0.5) * 100,
      size: Math.random() * 4 + 2,
      color: cs[i % cs.length],
      delay: Math.random() * 0.3,
    }))
  }, [colors])

  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center" style={{ background: colors.background }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
          animate={{
            x: [p.x, p.x * 0.2, 0, 0, p.x],
            y: [p.y, p.y * 0.2, 0, 0, p.y],
            opacity: [0, 1, 1, 0.3, 0],
            scale: [0, 1.2, 0.6, 0.3, 0],
          }}
          transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.25, 0.45, 0.7, 1], delay: p.delay }}
        />
      ))}
      <motion.span
        className="relative z-10 text-sm font-bold text-center px-2"
        style={{ color: colors.primary }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1, 1, 0.8] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.35, 0.5, 0.7, 1] }}
      >
        {nameEn}
      </motion.span>
    </div>
  )
}

/** コーポレートスライド: バーがスワイプ＋マスク展開 */
function CorporateSlideMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: colors.background }}>
      {/* Sliding bar */}
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{ backgroundColor: colors.primary }}
        animate={{ width: ['0%', '100%', '100%', '0%'] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.3, 0.35, 0.65] }}
      />
      {/* Bottom accent line */}
      <motion.div
        className="absolute bottom-2 left-0 right-0 h-[2px]"
        style={{ backgroundColor: colors.secondary, transformOrigin: 'left' }}
        animate={{ scaleX: [0, 0, 1, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.3, 0.6, 0.75, 1] }}
      />
      {/* Horizontal accent */}
      <motion.div
        className="absolute top-1/3 left-0 right-0 h-px"
        style={{ backgroundColor: colors.accent || colors.secondary }}
        animate={{ scaleX: [0, 0, 1, 1, 0], opacity: [0, 0, 0.4, 0.4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.4, 0.6, 0.75, 1] }}
      />
      {/* Text with mask reveal */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.span
          className="text-sm font-bold tracking-tight"
          style={{ color: colors.primary }}
          animate={{
            opacity: [0, 0, 1, 1, 0],
            clipPath: ['inset(0 100% 0 0)', 'inset(0 100% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0 0 100%)'],
          }}
          transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.3, 0.55, 0.75, 1] }}
        >
          {nameEn}
        </motion.span>
      </div>
    </div>
  )
}

/** ラグジュアリーモーフ: グラデーションblob＋文字間隔変化 */
function LuxuryMorphMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center" style={{ background: colors.background }}>
      {/* Mesh gradient blobs */}
      <motion.div
        className="absolute w-32 h-32 rounded-full blur-[40px]"
        style={{ backgroundColor: colors.primary, opacity: 0.2 }}
        animate={{ x: [-30, 30, -30], y: [-15, 15, -15], scale: [1, 1.3, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-24 h-24 rounded-full blur-[30px]"
        style={{ backgroundColor: colors.accent || '#D4AF37', opacity: 0.15 }}
        animate={{ x: [20, -20, 20], y: [15, -15, 15], scale: [1.1, 0.9, 1.1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-20 h-20 rounded-full blur-[25px]"
        style={{ backgroundColor: colors.secondary, opacity: 0.12 }}
        animate={{ x: [0, 25, 0], y: [20, 0, 20] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      {/* Text with letter spacing morph */}
      <motion.span
        className="relative z-10 text-base font-bold text-center px-2"
        style={{ color: colors.primary }}
        animate={{
          opacity: [0, 1, 1, 0],
          letterSpacing: ['0.3em', '0.3em', '0em', '0em'],
        }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.2, 0.5, 1] }}
      >
        {nameEn}
      </motion.span>
      {/* Decorative lines */}
      <motion.div
        className="absolute bottom-[30%] h-px w-12"
        style={{ background: `linear-gradient(to right, transparent, ${colors.accent || '#D4AF37'}, transparent)` }}
        animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 0.6, 0.6, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.35, 0.65, 1] }}
      />
    </div>
  )
}

/** デフォルト: シンプルなフェード */
function DefaultMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: colors.background }}>
      <motion.span
        className="text-base font-bold"
        style={{ color: colors.primary }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {nameEn}
      </motion.span>
    </div>
  )
}
