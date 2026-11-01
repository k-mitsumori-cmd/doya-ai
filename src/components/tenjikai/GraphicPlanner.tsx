'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Check, Eye, ImagePlus, Layers, Ruler } from 'lucide-react'
import { PanelArt } from './Booth3D'
import type { SiteAnalysis } from '@/lib/tenjikai/engine'
import type { GraphicPanel } from '@/lib/tenjikai/graphics'
import { ds } from '@/lib/tenjikai/tokens'

const EYE_MM = 1600

// 立面図：パネルの高さ方向の割付を寸法線つきで描く
function Elevation({ p, a, image }: { p: GraphicPanel; a: SiteAnalysis; image?: string }) {
  const H = 280
  const scale = H / Math.max(p.heightMm, 1800)
  const w = Math.max(40, p.widthMm * scale)
  const h = p.heightMm * scale
  const pad = { l: 116, r: 150, t: 16, b: 34 }
  const vbW = pad.l + w + pad.r
  const vbH = pad.t + H + pad.b
  const floorY = pad.t + H
  const y = (mm: number) => floorY - (mm - p.baseMm) * scale
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="h-auto w-full" role="img" aria-label={`${p.name}の立面図`}>
      <line x1={pad.l - 20} y1={floorY} x2={pad.l + w + 40} y2={floorY} stroke={ds.ink} strokeWidth={1.5} />
      <text x={pad.l - 20} y={floorY + 14} fontSize="9" fill={ds.sub} style={{ fontVariantNumeric: 'tabular-nums' }}>FL±0</text>
      <foreignObject x={pad.l} y={floorY - h} width={w} height={h}>
        <div style={{ width: '100%', height: '100%' }}>
          <PanelArt p={p} a={a} image={image} />
        </div>
      </foreignObject>
      <rect x={pad.l} y={floorY - h} width={w} height={h} fill="none" stroke={ds.ink} strokeWidth={1.2} />
      {/* 段の境界と注記 */}
      {p.zones.map((z, i) => {
        const top = y(Math.min(z.toMm, p.baseMm + p.heightMm))
        const bottom = y(Math.max(z.fromMm, p.baseMm))
        const mid = (top + bottom) / 2
        return (
          <motion.g key={z.label} initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }}>
            <line x1={pad.l} y1={top} x2={pad.l + w} y2={top} stroke={ds.ink} strokeDasharray="3 3" strokeWidth={0.6} />
            <line x1={pad.l + w + 6} y1={mid} x2={pad.l + w + 18} y2={mid} stroke={ds.blue} />
            <text x={pad.l + w + 22} y={mid - 2} fontSize="10" fontWeight={900} fill={ds.blue}>{z.label}</text>
            <text x={pad.l + w + 22} y={mid + 11} fontSize="8" fill={ds.sub} style={{ fontVariantNumeric: 'tabular-nums' }}>{z.fromMm}–{z.toMm}</text>
          </motion.g>
        )
      })}
      {/* 高さ寸法 */}
      <line x1={pad.l - 12} y1={floorY - h} x2={pad.l - 12} y2={floorY} stroke={ds.sub} />
      <text x={pad.l - 16} y={floorY - h / 2} fontSize="9" fill={ds.sub} style={{ fontVariantNumeric: 'tabular-nums' }} textAnchor="middle" transform={`rotate(-90 ${pad.l - 16} ${floorY - h / 2})`}>H {p.heightMm.toLocaleString()}</text>
      {/* 幅寸法 */}
      <line x1={pad.l} y1={floorY + 20} x2={pad.l + w} y2={floorY + 20} stroke={ds.sub} />
      <text x={pad.l + w / 2} y={floorY + 31} fontSize="9" fill={ds.sub} style={{ fontVariantNumeric: 'tabular-nums' }} textAnchor="middle">W {p.widthMm.toLocaleString()}</text>
      {/* 目線の高さ */}
      {p.baseMm < EYE_MM && EYE_MM < p.baseMm + p.heightMm + 400 && (
        <g>
          <line x1={60} y1={y(EYE_MM)} x2={pad.l + w + 4} y2={y(EYE_MM)} stroke="#f59e0b" strokeWidth={1.2} />
          <text x={pad.l - 22} y={y(EYE_MM) + 11} fontSize="8" fontWeight={700} fill="#d97706" textAnchor="end">目線 1,600</text>
        </g>
      )}
      {/* 人物スケール */}
      <g transform={`translate(6 ${floorY - 1700 * scale}) scale(${(1700 * scale) / 110})`} opacity={0.5}>
        <circle cx="15" cy="9" r="8" fill={ds.muted} />
        <path d="M4 22 Q15 16 26 22 L24 62 L21 108 L16 108 L15 70 L14 108 L9 108 L6 62 Z" fill={ds.muted} />
      </g>
    </svg>
  )
}

interface Props {
  panels: GraphicPanel[]
  analysis: SiteAnalysis
  images: Record<string, string>
  selectedPanelId?: string
  onSelectPanel: (id: string) => void
  onGenerate: (p: GraphicPanel) => void
}

export default function GraphicPlanner({ panels, analysis, images, selectedPanelId, onSelectPanel, onGenerate }: Props) {
  const p = panels.find((x) => x.id === selectedPanelId) ?? panels[0]
  const done = panels.filter((x) => images[x.id]).length
  if (!p) return null

  return (
    <section className="rounded-[var(--r)] border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-black text-ink"><Layers className="h-4 w-4 text-doya-500" />グラフィック割付</h2>
          <p className="text-[13px] leading-relaxed text-gray-700">壁面・カウンター・バナーのどこに、どの高さで、何を描くかを決めています。上段は遠くから読ませ、下段は什器で隠れるので文字を置きません。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200">
            <motion.div className="h-full rounded-full bg-doya-500" animate={{ width: `${(done / panels.length) * 100}%` }} />
          </div>
          <span className="font-mono text-[12px] font-bold text-ink">画像 {done}/{panels.length} 面</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* 面の一覧。見本を大きく、選んだ面は青い枠と印で分かるようにする（2026-10-26 ユーザーの指摘「見やすく、はっきり」） */}
        <ul className="flex max-h-[560px] flex-col gap-2 overflow-y-auto pr-1" aria-label="面の一覧">
          {panels.map((x, i) => {
            const on = p.id === x.id
            return (
              <motion.li key={x.id} initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelectPanel(x.id)}
                  className={clsx(
                    'relative flex w-full items-center gap-3 rounded-[var(--r-sm)] border-2 p-2.5 text-left transition-colors',
                    on ? 'border-doya-500 bg-doya-50 shadow-[0_0_0_3px_var(--blue-line)]' : 'border-gray-200 bg-white hover:border-doya-200 hover:bg-gray-50',
                  )}
                >
                  <div className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 p-1">
                    {/* 横長の面は幅に、縦長の面は高さに合わせる（縦横比を崩さない） */}
                    <div className="overflow-hidden rounded border border-gray-300 bg-white" style={{ aspectRatio: `${x.widthMm} / ${x.heightMm}`, ...(x.widthMm / x.heightMm > 104 / 72 ? { width: '100%' } : { height: '100%' }) }}>
                      <PanelArt p={x} a={analysis} image={images[x.id]} compact />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={clsx('text-[13px] font-black leading-snug', on ? 'text-doya-700' : 'text-ink')}>{x.name}</p>
                    <p className="mt-0.5 font-mono text-[12px] text-gray-700">{x.widthMm.toLocaleString()} × {x.heightMm.toLocaleString()} mm</p>
                    {images[x.id] ? (
                      <span className="mt-1 inline-block rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">画像あり</span>
                    ) : (
                      <span className="mt-1 inline-block rounded border border-gray-300 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">画像なし</span>
                    )}
                  </div>
                  {on && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-doya-500 text-white" aria-hidden>
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </motion.li>
            )
          })}
        </ul>

        <AnimatePresence mode="wait">
          <motion.div key={p.id} initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div className="rounded-[var(--r-sm)] border border-gray-100 bg-[var(--surface-2)] p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-black text-gray-500"><Ruler className="h-3.5 w-3.5" />立面図（単位 mm）</p>
              <Elevation p={p} a={analysis} image={images[p.id]} />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-base font-black text-ink">{p.name}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-amber-700"><Eye className="h-3.5 w-3.5" />視認距離 {p.viewDistanceM}m ─ {p.role}</p>
              </div>
              <div className="rounded-[var(--r-sm)] bg-doya-50 p-3">
                <p className="text-[11px] font-black text-doya-600">描く画像</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{p.visual}</p>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {p.zones.map((z) => (
                    <tr key={z.label} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap py-2 pr-3 font-black text-ink">{z.label}</td>
                      <td className="whitespace-nowrap py-2 pr-3 font-mono text-gray-500">{z.fromMm}–{z.toMm}</td>
                      <td className="py-2 text-gray-600">{z.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-500">素材・施工：{p.material}</p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => onGenerate(p)} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-doya-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-doya-500/30">
                <ImagePlus className="h-4 w-4" />{images[p.id] ? 'この面の画像を作り直す' : 'この面の画像を生成'}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
