'use client'

import { motion } from 'framer-motion'
import type { BoothElement, BoothPlan, SiteAnalysis } from '@/lib/tenjikai/engine'
import { ds } from '@/lib/tenjikai/tokens'

// 等角投影：x軸は右下、y軸は左下、z軸は上
const C = Math.cos(Math.PI / 6)
const S = Math.sin(Math.PI / 6)
const U = 46 // 1m あたりのpx

const P = (x: number, y: number, z: number) => [(x - y) * C * U, (x + y) * S * U - z * U] as const
const pts = (arr: (readonly [number, number])[]) => arr.map((p) => p.join(',')).join(' ')

const FILL: Record<BoothElement['kind'], { top: string; left: string; right: string }> = {
  wall: { top: ds.surface2, left: ds.paper, right: ds.line },
  monitor: { top: '#3a3550', left: '#15121f', right: '#25203a' },
  counter: { top: ds.paper, left: ds.track, right: ds.lineStrong },
  table: { top: '#f7e7c6', left: '#e2c48c', right: '#c9a96b' },
  demo: { top: ds.blueSoft, left: ds.blueLine, right: ds.k1 },
  rollup: { top: ds.paper, left: ds.blue, right: ds.navy },
  storage: { top: ds.track, left: ds.lineStrong, right: ds.muted },
  sign: { top: ds.blue, left: ds.blueDeep, right: ds.navy },
}

function Box({ e, colors, selected, onSelect, i }: { e: BoothElement; colors: SiteAnalysis['colors']; selected: boolean; onSelect?: (id: string) => void; i: number }) {
  const z = e.z ?? 0
  const { x, y, w, d, h } = e
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const front = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const side = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)]
  let f = FILL[e.kind]
  if (e.kind === 'rollup' || e.kind === 'sign') f = { top: f.top, left: colors.primary, right: colors.secondary }
  const stroke = selected ? ds.yellow : 'rgba(16,22,51,.35)'
  return (
    <motion.g
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + i * 0.09, type: 'spring', stiffness: 260, damping: 18 }}
      onClick={() => onSelect?.(e.id)}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      <polygon points={pts(front)} fill={f.left} stroke={stroke} strokeWidth={selected ? 2 : 0.8} />
      <polygon points={pts(side)} fill={f.right} stroke={stroke} strokeWidth={selected ? 2 : 0.8} />
      <polygon points={pts(top)} fill={f.top} stroke={stroke} strokeWidth={selected ? 2 : 0.8} />
      {e.kind === 'monitor' && w > d && (
        <polygon points={pts([P(x + 0.06, y + d, z + 0.06), P(x + w - 0.06, y + d, z + 0.06), P(x + w - 0.06, y + d, z + h - 0.06), P(x + 0.06, y + d, z + h - 0.06)])} fill={colors.primary} opacity={0.85}>
          <animate attributeName="opacity" values=".85;.45;.85" dur="2.4s" repeatCount="indefinite" />
        </polygon>
      )}
    </motion.g>
  )
}

export default function IsoBooth({ plan, analysis, selectedId, onSelect, compact }: { plan: BoothPlan; analysis: SiteAnalysis; selectedId?: string; onSelect?: (id: string) => void; compact?: boolean }) {
  const W = plan.widthM
  const D = plan.depthM
  const topZ = Math.max(2.8, ...plan.elements.map((e) => (e.z ?? 0) + e.h)) + 0.15
  const corners = [P(0, 0, 0), P(W, 0, 0), P(W + 1.2, D, 0), P(0, D + 1.2, 0), P(0, 0, topZ), P(W, 0, topZ)]
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const pad = 14
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2]

  const sorted = [...plan.elements].sort((a, b) => a.x + a.w / 2 + (a.y + a.d / 2) - (b.x + b.w / 2 + (b.y + b.d / 2)) || (a.z ?? 0) - (b.z ?? 0))
  const back = plan.elements.find((e) => e.kind === 'wall' && e.w > e.d)
  const sideW = plan.elements.find((e) => e.kind === 'wall' && e.d > e.w)

  // 背面壁の +y 面に沿った文字の変換行列
  const [bx, by] = P(0.35, 0.1, 2.2)
  const [sx, sy] = P(0.1, (sideW?.d ?? 0) - 0.25, 2.0)

  return (
    <svg viewBox={vb.join(' ')} className="h-full w-full" role="img" aria-label={`${plan.name}のブース模型`}>
      <defs>
        <pattern id="carpet" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={ds.blueSoft} />
          <circle cx="2" cy="2" r=".8" fill="#dccbf6" />
        </pattern>
      </defs>
      {/* 通路 */}
      <polygon points={pts([P(-0.6, D, 0), P(W + 1.6, D, 0), P(W + 1.6, D + 1.6, 0), P(-0.6, D + 1.6, 0)])} fill={ds.line} />
      <polygon points={pts([P(W, -0.6, 0), P(W + 1.6, -0.6, 0), P(W + 1.6, D, 0), P(W, D, 0)])} fill={ds.line} />
      {/* 床 */}
      <motion.polygon initial={false} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} points={pts([P(0, 0, 0), P(W, 0, 0), P(W, D, 0), P(0, D, 0)])} fill="url(#carpet)" stroke={ds.blue} strokeWidth="1.5" />
      {/* 小間の区切り線 */}
      {Array.from({ length: Math.max(1, Math.round(W / 2.9)) - 1 }).map((_, i, arr) => {
        const gx = ((i + 1) * W) / (arr.length + 1)
        return <line key={`gx${i}`} x1={P(gx, 0, 0)[0]} y1={P(gx, 0, 0)[1]} x2={P(gx, D, 0)[0]} y2={P(gx, D, 0)[1]} stroke={ds.blueLine} strokeDasharray="4 4" />
      })}
      {Array.from({ length: Math.max(1, Math.round(D / 2.9)) - 1 }).map((_, i, arr) => {
        const gy = ((i + 1) * D) / (arr.length + 1)
        return <line key={`gy${i}`} x1={P(0, gy, 0)[0]} y1={P(0, gy, 0)[1]} x2={P(W, gy, 0)[0]} y2={P(W, gy, 0)[1]} stroke={ds.blueLine} strokeDasharray="4 4" />
      })}
      {sorted.map((e, i) => (
        <Box key={`${plan.variant}-${e.id}`} e={e} colors={analysis.colors} selected={selectedId === e.id} onSelect={onSelect} i={i} />
      ))}
      {back && (
        <motion.g initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} transform={`matrix(${C},${S},0,1,${bx},${by})`}>
          <text x="0" y="0" fontSize={compact ? 15 : 17} fontWeight={900} fill={analysis.colors.secondary}>
            {analysis.headline.split('\n')[0]}
          </text>
          <text x="0" y="22" fontSize={compact ? 15 : 17} fontWeight={900} fill={analysis.colors.primary}>
            {analysis.headline.split('\n')[1] ?? ''}
          </text>
          <text x="0" y="40" fontSize="8" fill={ds.sub} fontWeight={700}>{analysis.brand}</text>
        </motion.g>
      )}
      {sideW && (
        <motion.g initial={false} animate={{ opacity: 1 }} transition={{ delay: 1 }} transform={`matrix(${C},${-S},0,1,${sx},${sy})`}>
          <rect x="-4" y="-14" width={Math.min(150, sideW.d * U * 0.8)} height="44" fill={analysis.colors.primary} rx="2" />
          <text x="4" y="4" fontSize="11" fontWeight={900} fill="#fff">{analysis.valueProps[0].title}</text>
          <text x="4" y="20" fontSize="8" fill="#fff" opacity=".85">{analysis.valueProps[1].title}</text>
        </motion.g>
      )}
      {/* 寸法 */}
      <g style={{ fontVariantNumeric: 'tabular-nums' }} fontSize="10" fill={ds.sub}>
        <text x={P(W / 2, D + 0.9, 0)[0]} y={P(W / 2, D + 0.9, 0)[1]} transform={`rotate(30 ${P(W / 2, D + 0.9, 0)[0]} ${P(W / 2, D + 0.9, 0)[1]})`} textAnchor="middle">
          {W.toFixed(2)}m
        </text>
        <text x={P(W + 0.9, D / 2, 0)[0]} y={P(W + 0.9, D / 2, 0)[1]} transform={`rotate(-30 ${P(W + 0.9, D / 2, 0)[0]} ${P(W + 0.9, D / 2, 0)[1]})`} textAnchor="middle">
          {D.toFixed(2)}m
        </text>
      </g>
    </svg>
  )
}
