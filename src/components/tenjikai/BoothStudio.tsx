'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Footprints, ImagePlus } from 'lucide-react'
import IsoBooth from './IsoBooth'
import ImageGenModal, { svgToPngBase64 } from './ImageGenModal'
import { CountUp, PageHeader } from './ui'
import { buildBoothRenderPrompt } from '@/lib/tenjikai/imagegen'
import { KIND_LABEL, man, planCost, yen, type BoothPlan, type ProjectInput, type SiteAnalysis } from '@/lib/tenjikai/engine'

function PlanView({ plan, selectedId, onSelect }: { plan: BoothPlan; selectedId?: string; onSelect: (id: string) => void }) {
  const s = 60
  const W = plan.widthM * s
  const D = plan.depthM * s
  return (
    <svg viewBox={`-40 -30 ${W + 80} ${D + 90}`} className="h-full w-full" role="img" aria-label={`${plan.name}の平面図`}>
      <rect x={0} y={D} width={W + 30} height={40} fill="#e9e6f0" />
      <text x={W / 2} y={D + 26} textAnchor="middle" fontSize="11" fill="#5d5873" fontWeight={700}>通路</text>
      <motion.rect initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} x={0} y={0} width={W} height={D} fill="#faf7ff" stroke="#1b1530" strokeWidth={2} />
      {plan.elements.map((e, i) => (
        <motion.g key={`${plan.variant}-${e.id}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.06, type: 'spring', stiffness: 300, damping: 20 }} style={{ transformOrigin: `${(e.x + e.w / 2) * s}px ${(e.y + e.d / 2) * s}px`, cursor: 'pointer' }} onClick={() => onSelect(e.id)}>
          <rect x={e.x * s} y={e.y * s} width={Math.max(e.w * s, 4)} height={Math.max(e.d * s, 4)} rx={2} fill={e.kind === 'wall' ? '#7f19e6' : e.kind === 'monitor' ? '#1b1530' : e.kind === 'table' ? '#f7e7c6' : e.kind === 'demo' ? '#ecdcfd' : '#ffffff'} stroke={selectedId === e.id ? '#ffb020' : '#1b1530'} strokeWidth={selectedId === e.id ? 3 : 1} opacity={e.z && e.z > 3 ? 0.4 : 1} />
          {e.w * s > 40 && e.d * s > 14 && (
            <text x={(e.x + e.w / 2) * s} y={(e.y + e.d / 2) * s + 4} textAnchor="middle" fontSize="10" fontWeight={700} fill={e.kind === 'monitor' ? '#fff' : '#1b1530'}>
              {KIND_LABEL[e.kind]}
            </text>
          )}
        </motion.g>
      ))}
      <g fontFamily="var(--font-mono)" fontSize="10" fill="#5d5873">
        <line x1={0} y1={-14} x2={W} y2={-14} stroke="#5d5873" />
        <text x={W / 2} y={-18} textAnchor="middle">{Math.round(plan.widthM * 1000).toLocaleString()}</text>
        <line x1={-14} y1={0} x2={-14} y2={D} stroke="#5d5873" />
        <text x={-18} y={D / 2} textAnchor="middle" transform={`rotate(-90 -18 ${D / 2})`}>{Math.round(plan.depthM * 1000).toLocaleString()}</text>
      </g>
    </svg>
  )
}

export default function BoothStudio({ plans, variant, setVariant, input, analysis }: { plans: BoothPlan[]; variant: 'A' | 'B' | 'C'; setVariant: (v: 'A' | 'B' | 'C') => void; input: ProjectInput; analysis: SiteAnalysis }) {
  const [view, setView] = useState<'iso' | 'plan'>('iso')
  const [selectedId, setSelectedId] = useState<string>()
  const plan = plans.find((p) => p.variant === variant) ?? plans[0]
  const cost = planCost(plan, input)
  const selected = plan.elements.find((e) => e.id === selectedId)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [renders, setRenders] = useState<Record<string, string[]>>({})

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader eyebrow="BOOTH DESIGN" title="ブース設計" desc="出展目的と小間の位置から3つの設営案を作りました。模型の部材をクリックすると、寸法と概算費用を確認できます。" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-2xl border border-gray-200 bg-white p-1">
          {plans.map((p) => (
            <button key={p.variant} onClick={() => { setVariant(p.variant); setSelectedId(undefined) }} className={clsx('relative rounded-xl px-4 py-2 text-left', variant === p.variant ? 'text-white' : 'text-ink hover:bg-gray-50')}>
              {variant === p.variant && <motion.span layoutId="variantTab" className="absolute inset-0 rounded-xl bg-doya-500" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative block font-mono text-[10px] opacity-70">案 {p.variant}</span>
              <span className="relative block text-sm font-black">{p.name}</span>
            </button>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { setView('iso'); setGenOpen(true) }} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-black text-white shadow-lg">
          <ImagePlus className="h-4 w-4" /> 3D完成予想図を画像生成
        </motion.button>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-xs font-black">
          {(['iso', 'plan'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={clsx('rounded-lg px-3 py-1.5', view === v ? 'bg-white text-doya-600 shadow' : 'text-gray-500')}>
              {v === 'iso' ? '立体模型' : '平面図'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <div ref={canvasRef} className="aspect-[4/3] w-full p-3">
            <AnimatePresence mode="wait">
              <motion.div key={`${variant}-${view}`} initial={{ opacity: 0, rotateX: 8 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="h-full w-full">
                {view === 'iso' ? <IsoBooth plan={plan} analysis={analysis} selectedId={selectedId} onSelect={setSelectedId} /> : <PlanView plan={plan} selectedId={selectedId} onSelect={setSelectedId} />}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 bg-amber-50/60 px-4 py-2.5 text-xs font-bold text-amber-800">
            <Footprints className="h-4 w-4 flex-shrink-0" />
            来場者の動線：{plan.flow}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="text-[11px] font-black text-doya-500">コンセプト</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{plan.concept}</p>
            <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-3">
              <span className="text-xs font-black text-gray-500">装飾・施工の概算</span>
              <CountUp value={cost.total} format={man} className="font-mono text-xl font-semibold text-ink tabular" />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-gray-500">
              <dt>部材</dt><dd className="text-right font-mono tabular">{yen(cost.parts)}</dd>
              <dt>床（カーペット）</dt><dd className="text-right font-mono tabular">{yen(cost.carpet)}</dd>
              <dt>デザイン費</dt><dd className="text-right font-mono tabular">{yen(cost.design)}</dd>
              <dt>施工費</dt><dd className="text-right font-mono tabular">{yen(cost.labor)}</dd>
            </dl>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5">
            <p className="mb-2 text-[11px] font-black text-gray-500">部材リスト（{plan.elements.length}点）</p>
            <ul className="flex flex-col gap-1">
              {plan.elements.map((e, i) => (
                <motion.li key={`${variant}-${e.id}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <button onClick={() => setSelectedId(e.id)} className={clsx('flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors', selectedId === e.id ? 'bg-amber-50 ring-2 ring-amber-300' : 'hover:bg-gray-50')}>
                    <span className="min-w-0 truncate font-bold text-ink">{e.label}</span>
                    <span className="flex-shrink-0 font-mono text-gray-500 tabular">{yen(e.costYen)}</span>
                  </button>
                </motion.li>
              ))}
            </ul>
            <AnimatePresence>
              {selected && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 rounded-xl bg-gray-50 p-3 font-mono text-[11px] text-gray-600">
                    W {Math.round(selected.w * 1000)} × D {Math.round(selected.d * 1000)} × H {Math.round(selected.h * 1000)} mm
                    {selected.z ? ` / 設置高 ${Math.round(selected.z * 1000)} mm` : ''}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-ink">完成予想図（画像生成）</h2>
          <span className="text-[11px] font-bold text-gray-500">立体模型を参照画像として渡し、配置を保ったまま描かせます</span>
        </div>
        {renders[variant]?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {renders[variant].map((src, i) => (
              <motion.img key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={src} alt={`${plan.name}の完成予想図 ${i + 1}`} className="w-full rounded-2xl border border-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-center">
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.3 }} />
                <p className="relative px-4 text-[11px] font-bold text-gray-400">{['来場者目線（斜め前方）', '通路の正面から', '真上からの俯瞰'][i]}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ImageGenModal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title={`3D完成予想図を生成：案${plan.variant} ${plan.name}`}
        prompt={buildBoothRenderPrompt(plan, analysis)}
        aspectRatio="4:3"
        getReference={async () => {
          const svg = canvasRef.current?.querySelector('svg')
          return svg ? svgToPngBase64(svg as SVGSVGElement) : undefined
        }}
        onResult={(imgs) => setRenders((r) => ({ ...r, [variant]: imgs }))}
      />
    </div>
  )
}
