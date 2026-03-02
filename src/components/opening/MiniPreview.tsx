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
    case 'typewriter-reveal':
      return <TypewriterMini colors={colors} nameEn={nameEn} />
    case 'glitch-wave':
      return <GlitchWaveMini colors={colors} nameEn={nameEn} />
    case 'zoom-rotate':
      return <ZoomRotateMini colors={colors} nameEn={nameEn} />
    case 'gradient-wipe':
      return <GradientWipeMini colors={colors} nameEn={nameEn} />
    case 'text-scramble':
      return <TextScrambleMini colors={colors} nameEn={nameEn} />
    case 'neon-glow':
      return <NeonGlowMini colors={colors} nameEn={nameEn} />
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

/** タイプライター: カーソル付き1文字ずつ表示 */
function TypewriterMini({ colors, nameEn }: MiniProps) {
  const chars = nameEn.slice(0, 12)
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: colors.background }}>
      {/* Top line decoration */}
      <motion.div
        className="h-px w-12 mb-3"
        style={{ backgroundColor: colors.accent || colors.primary }}
        animate={{ scaleX: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.2, 0.7, 1] }}
      />
      <div className="flex items-center font-mono">
        {chars.split('').map((c, i) => (
          <motion.span
            key={i}
            className="text-sm font-bold"
            style={{ color: colors.primary }}
            animate={{ opacity: [0, 0, 1, 1, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.1 + i * 0.04, 0.12 + i * 0.04, 0.75, 1],
            }}
          >
            {c}
          </motion.span>
        ))}
        <motion.span
          style={{ color: colors.accent || colors.primary }}
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          |
        </motion.span>
      </div>
      {/* Bottom line decoration */}
      <motion.div
        className="h-px w-8 mt-3"
        style={{ backgroundColor: colors.secondary }}
        animate={{ scaleX: [0, 0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.5, 0.7, 0.85, 1] }}
      />
    </div>
  )
}

/** グリッチウェーブ: スキャンライン＋文字が波打つ */
function GlitchWaveMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center" style={{ background: colors.background }}>
      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${colors.primary}10 3px, ${colors.primary}10 4px)`,
      }} />
      {/* Glitch bars */}
      <motion.div
        className="absolute left-0 right-0 h-[2px]"
        style={{ top: '35%', backgroundColor: colors.accent || colors.primary }}
        animate={{ scaleX: [0, 1, 0], x: ['-50%', '0%', '50%'], opacity: [0, 0.7, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.3 }}
      />
      <motion.div
        className="absolute left-0 right-0 h-[2px]"
        style={{ top: '65%', backgroundColor: colors.primary }}
        animate={{ scaleX: [0, 1, 0], x: ['50%', '0%', '-50%'], opacity: [0, 0.5, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.6 }}
      />
      {/* Text with wave */}
      <div className="flex">
        {nameEn.slice(0, 10).split('').map((c, i) => (
          <motion.span
            key={i}
            className="text-base font-bold"
            style={{ color: colors.primary, display: 'inline-block' }}
            animate={{
              y: [0, -6, 0, 6, 0],
              opacity: [0, 1, 1, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.08,
              times: [0, 0.25, 0.5, 0.75, 1],
            }}
          >
            {c === ' ' ? '\u00A0' : c}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

/** ズームローテート: 回転しながらズームイン */
function ZoomRotateMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center" style={{ background: colors.background }}>
      {/* Expanding rings */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{ borderColor: i === 0 ? colors.primary : colors.accent || colors.secondary }}
          animate={{
            width: [0, 200],
            height: [0, 200],
            opacity: [0.5, 0],
          }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.6 }}
        />
      ))}
      {/* Text zooms in with rotation */}
      <motion.span
        className="relative z-10 text-base font-black text-center"
        style={{ color: colors.primary }}
        animate={{
          scale: [3, 1, 1, 0.8],
          rotate: [-8, 0, 0, 5],
          opacity: [0, 1, 1, 0],
        }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.3, 0.7, 1] }}
      >
        {nameEn}
      </motion.span>
    </div>
  )
}

/** グラデーションワイプ: 色面がワイプ展開 */
function GradientWipeMini({ colors, nameEn }: MiniProps) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: colors.background }}>
      {/* Wipe layer 1 */}
      <motion.div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
        animate={{
          clipPath: [
            'polygon(0 0, 0 0, 0 100%, 0 100%)',
            'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
            'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)',
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.3, 0.6] }}
      />
      {/* Bottom stripe */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent || colors.secondary})` }}
        animate={{ scaleX: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0.4, 0.6, 0.8, 1] }}
      />
      {/* Text with clip reveal */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <motion.span
          className="text-base font-bold"
          style={{ color: colors.primary }}
          animate={{
            clipPath: ['inset(0 100% 0 0)', 'inset(0 100% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0 0 100%)'],
            opacity: [0, 0, 1, 1, 0],
          }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.25, 0.45, 0.75, 1] }}
        >
          {nameEn}
        </motion.span>
      </div>
    </div>
  )
}

/** テキストスクランブル: ランダム文字→確定 */
function TextScrambleMini({ colors, nameEn }: MiniProps) {
  const matrixChars = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: `${12 + i * 10}%`,
      delay: Math.random() * 0.5,
    })),
  [])

  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center" style={{ background: colors.background }}>
      {/* Falling code lines */}
      {matrixChars.map((m) => (
        <motion.div
          key={m.id}
          className="absolute w-px"
          style={{
            left: m.left,
            height: '20%',
            background: `linear-gradient(to bottom, transparent, ${colors.primary}50, transparent)`,
          }}
          animate={{ top: ['-20%', '120%'], opacity: [0, 0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: m.delay }}
        />
      ))}
      {/* Scramble text effect (simplified) */}
      <motion.span
        className="text-sm font-bold font-mono tracking-wider relative z-10"
        style={{ color: colors.primary }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          filter: ['blur(4px)', 'blur(4px)', 'blur(0px)', 'blur(0px)', 'blur(2px)'],
        }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.15, 0.4, 0.75, 1] }}
      >
        {nameEn}
      </motion.span>
      {/* Accent line */}
      <motion.div
        className="mt-2 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${colors.accent || colors.primary}, transparent)` }}
        animate={{ width: [0, 60, 60, 0], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0.35, 0.5, 0.7, 1] }}
      />
    </div>
  )
}

/** ネオングロー: ネオン管風フリッカー */
function NeonGlowMini({ colors, nameEn }: MiniProps) {
  const neon = (c: string) => `0 0 5px ${c}, 0 0 10px ${c}`
  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center" style={{ background: '#0a0a0a' }}>
      {/* Grid bg */}
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(${colors.primary}08 1px, transparent 1px), linear-gradient(90deg, ${colors.primary}08 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      }} />
      {/* Glow orb */}
      <motion.div
        className="absolute w-24 h-24 rounded-full"
        style={{ background: `radial-gradient(circle, ${colors.primary}25, transparent 70%)` }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      {/* Neon text with flicker */}
      <motion.span
        className="relative z-10 text-base font-bold text-center"
        style={{ color: colors.primary }}
        animate={{
          opacity: [0, 0.4, 0, 0.8, 0.6, 1, 0.9, 1, 1, 0],
          textShadow: [
            'none', neon(colors.primary), 'none', neon(colors.primary),
            'none', neon(colors.primary), neon(colors.primary), neon(colors.primary),
            neon(colors.primary), 'none',
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.08, 0.12, 0.2, 0.24, 0.35, 0.5, 0.65, 0.8, 1] }}
      >
        {nameEn}
      </motion.span>
      {/* Neon underline */}
      <motion.div
        className="mt-2 h-[1px]"
        style={{ backgroundColor: colors.accent || colors.primary, boxShadow: neon(colors.accent || colors.primary) }}
        animate={{ width: [0, 50, 50, 0], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0.3, 0.45, 0.75, 1] }}
      />
      {/* Corner accents */}
      {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos, i) => (
        <motion.div
          key={i}
          className={`absolute ${pos} w-2 h-2`}
          style={{
            borderTop: i < 2 ? `1px solid ${colors.primary}40` : 'none',
            borderBottom: i >= 2 ? `1px solid ${colors.primary}40` : 'none',
            borderLeft: i % 2 === 0 ? `1px solid ${colors.primary}40` : 'none',
            borderRight: i % 2 === 1 ? `1px solid ${colors.primary}40` : 'none',
          }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 4, repeat: Infinity, times: [0.2, 0.35, 0.7, 1] }}
        />
      ))}
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
