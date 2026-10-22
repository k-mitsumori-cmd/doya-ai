'use client'

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Check, Download, Footprints, ImagePlus, Loader2 } from 'lucide-react'
import IsoBooth from './IsoBooth'
import Booth3D from './Booth3D'
import GraphicPlanner from './GraphicPlanner'
import ImageGenModal from './ImageGenModal'
import EmptyState from './EmptyState'
import { CountUp, Modal, PageHeader } from './ui'
import { remainingLabel, requestImages, useImageQuota, type ImageGenFailure } from './useImageGen'
import { nearestRatio } from '@/lib/tenjikai/imagegen'
import { buildPanelPrompt, generateGraphicPlan, type GraphicPanel } from '@/lib/tenjikai/graphics'
import { KIND_LABEL, man, planCost, yen, type BoothPlan, type ProjectInput, type SiteAnalysis } from '@/lib/tenjikai/engine'
import { ds } from '@/lib/tenjikai/tokens'
import Image from 'next/image'
import { ShellCostBadge } from '@/components/shell/power'

function PlanView({ plan, selectedId, onSelect }: { plan: BoothPlan; selectedId?: string; onSelect: (id: string) => void }) {
  const s = 60
  const W = plan.widthM * s
  const D = plan.depthM * s
  return (
    <svg viewBox={`-40 -30 ${W + 80} ${D + 90}`} className="h-full w-full" role="img" aria-label={`${plan.name}の平面図`}>
      <rect x={0} y={D} width={W + 30} height={40} fill={ds.line} />
      <text x={W / 2} y={D + 26} textAnchor="middle" fontSize="11" fill={ds.sub} fontWeight={700}>通路</text>
      <motion.rect initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} x={0} y={0} width={W} height={D} fill="#faf7ff" stroke={ds.ink} strokeWidth={2} />
      {plan.elements.map((e, i) => (
        <motion.g key={`${plan.variant}-${e.id}`} initial={false} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.06, type: 'spring', stiffness: 300, damping: 20 }} style={{ transformOrigin: `${(e.x + e.w / 2) * s}px ${(e.y + e.d / 2) * s}px`, cursor: 'pointer' }} onClick={() => onSelect(e.id)}>
          <rect x={e.x * s} y={e.y * s} width={Math.max(e.w * s, 4)} height={Math.max(e.d * s, 4)} rx={2} fill={e.kind === 'wall' ? ds.blue : e.kind === 'monitor' ? ds.ink : e.kind === 'table' ? '#f7e7c6' : e.kind === 'demo' ? ds.blueSoft : ds.paper} stroke={selectedId === e.id ? ds.yellow : ds.ink} strokeWidth={selectedId === e.id ? 3 : 1} opacity={e.z && e.z > 3 ? 0.4 : 1} />
          {e.w * s > 40 && e.d * s > 14 && (
            <text x={(e.x + e.w / 2) * s} y={(e.y + e.d / 2) * s + 4} textAnchor="middle" fontSize="10" fontWeight={700} fill={e.kind === 'monitor' ? '#fff' : ds.ink}>
              {KIND_LABEL[e.kind]}
            </text>
          )}
        </motion.g>
      ))}
      <g style={{ fontVariantNumeric: 'tabular-nums' }} fontSize="10" fill={ds.sub}>
        <line x1={0} y1={-14} x2={W} y2={-14} stroke={ds.sub} />
        <text x={W / 2} y={-18} textAnchor="middle">{Math.round(plan.widthM * 1000).toLocaleString()}</text>
        <line x1={-14} y1={0} x2={-14} y2={D} stroke={ds.sub} />
        <text x={-18} y={D / 2} textAnchor="middle" transform={`rotate(-90 -18 ${D / 2})`}>{Math.round(plan.depthM * 1000).toLocaleString()}</text>
      </g>
    </svg>
  )
}

type Images = Record<string, string>

interface StudioProps {
  plans: BoothPlan[]
  variant: 'A' | 'B' | 'C'
  setVariant: (v: 'A' | 'B' | 'C') => void
  input: ProjectInput
  analysis: SiteAnalysis
  panelImages: Images
  setPanelImages: (f: (m: Images) => Images) => void
}

const VIEW_LABEL = { '3d': '3D', iso: '等角模型', plan: '平面図' } as const

// 利用者の流れ（2026-10-19 ユーザー指示）: 条件を入れる → 3D で確かめる → 面の画像を作る（3D に貼られる） → 書き出す
const FLOW = ['条件を入れる', '3Dで確かめる', '面の画像を作る', '書き出す'] as const

function FlowSteps({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="ブース設計の進め方">
      {FLOW.map((label, i) => {
        const done = i < current
        const now = i === current
        return (
          <li key={label} aria-current={now ? 'step' : undefined} className={clsx('flex items-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-[13px] font-bold', now ? 'border-doya-500 bg-white text-ink shadow-sm' : done ? 'border-transparent bg-white/70 text-[var(--sub)]' : 'border-transparent bg-white/40 text-[var(--muted)]')}>
            <span className={clsx('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px]', done ? 'bg-doya-500 text-white' : now ? 'bg-doya-50 text-doya-600 ring-2 ring-doya-500' : 'bg-gray-100 text-gray-500')}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

// 書き出し：割付表（CSV）と、作った面の画像を保存する
function download(name: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function extOf(dataUrl: string) {
  const m = /^data:image\/([a-z+]+);/.exec(dataUrl)
  return m ? (m[1] === 'svg+xml' ? 'svg' : m[1] === 'jpeg' ? 'jpg' : m[1]) : 'png'
}

async function exportPack(plan: BoothPlan, panels: GraphicPanel[], images: Images) {
  const safe = (t: string) => t.replace(/[\\/:*?"<>|\s]+/g, '_')
  const rows = [
    ['番号', '面', '幅(mm)', '高さ(mm)', '床からの高さ(mm)', '素材', '見出し', '画像ファイル'],
    ...panels.map((p, i) => [String(i + 1), p.name, String(p.widthMm), String(p.heightMm), String(p.baseMm), p.material, p.headline, images[p.id] ? `${String(i + 1).padStart(2, '0')}_${safe(p.name)}.${extOf(images[p.id])}` : '（未作成）']),
  ]
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  download(`ブース案${plan.variant}_グラフィック割付.csv`, url)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  for (const [i, p] of panels.entries()) {
    const img = images[p.id]
    if (!img) continue
    await new Promise((r) => setTimeout(r, 250)) // まとめて保存するとブラウザーに止められるため、少し間をあける
    download(`${String(i + 1).padStart(2, '0')}_${safe(p.name)}.${extOf(img)}`, img)
  }
}

export default function BoothStudio({ plans, variant, setVariant, input, analysis, panelImages, setPanelImages }: StudioProps) {
  const [view, setView] = useState<'3d' | 'iso' | 'plan'>('3d')
  const [selectedId, setSelectedId] = useState<string>()
  const plan = plans.find((p) => p.variant === variant) ?? plans[0]
  const cost = planCost(plan, input)
  const selected = plan.elements.find((e) => e.id === selectedId)
  const panels = useMemo(() => generateGraphicPlan(plan, analysis), [plan, analysis])
  const [panelId, setPanelId] = useState<string>()
  const [panelTarget, setPanelTarget] = useState<GraphicPanel | null>(null)
  const { quota, refresh } = useImageQuota()
  const [batchOpen, setBatchOpen] = useState(false)
  const [batch, setBatch] = useState<{ running: boolean; done: number; total: number; error?: ImageGenFailure }>({ running: false, done: 0, total: 0 })
  const threeRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const missing = panels.filter((p) => !panelImages[p.id])
  const madeCount = panels.length - missing.length
  const allMade = panels.length > 0 && missing.length === 0
  const step = allMade ? 3 : 2

  const selectElement = (id: string) => {
    setSelectedId(id)
    const first = panels.find((p) => p.elementId === id)
    if (first) setPanelId(first.id)
  }
  const selectPanel = (id: string) => {
    setPanelId(id)
    setSelectedId(panels.find((p) => p.id === id)?.elementId)
  }

  // まだ画像の無い面を、1面ずつ順に作る。できた面から 3D に貼られる。止まったら、残りの面から作り直せる
  const runBatch = async () => {
    setBatchOpen(false)
    setView('3d')
    threeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const todo = missing
    setBatch({ running: true, done: 0, total: todo.length })
    for (const [i, p] of todo.entries()) {
      const r = await requestImages({ prompt: buildPanelPrompt(p, analysis), aspectRatio: nearestRatio(p.widthMm, p.heightMm), kind: 'graphic_panel' })
      if (!r.ok) {
        setBatch({ running: false, done: i, total: todo.length, error: r })
        void refresh()
        return
      }
      setPanelImages((m) => ({ ...m, [p.id]: r.images[0] }))
      setBatch({ running: true, done: i + 1, total: todo.length })
    }
    setBatch({ running: false, done: todo.length, total: todo.length })
    void refresh()
  }

  const left = remainingLabel(quota)
  const notEnough = quota?.enabled && quota.remaining !== null && quota.remaining < missing.length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader title="ブース設計" desc="出展の目的と小間の位置から、3つの設営案を作りました。3Dはドラッグで回せます。面の画像を作ると、3Dの壁面に貼られます。" />

      <FlowSteps current={step} />

      {/* 次にやること */}
      <div className="flex flex-col gap-3 rounded-[var(--r)] border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink">
            {allMade ? 'すべての面に画像を貼りました。書き出して、印刷会社に渡せます。' : batch.running ? `面の画像を作っています（${batch.done}/${batch.total}面）。できた面から3Dに貼られます。` : `次は、面の画像を作ります（${madeCount}/${panels.length}面が完成）。`}
          </p>
          {left && !allMade && <p className="mt-0.5 text-[13px] text-[var(--sub)]">{left}</p>}
        </div>
        {allMade ? (
          <button onClick={() => void exportPack(plan, panels, panelImages)} className="inline-flex min-h-[44px] flex-shrink-0 items-center justify-center gap-2 rounded-[var(--r-sm)] bg-doya-500 px-5 text-sm font-black text-white shadow-lg shadow-doya-500/30">
            <Download className="h-4 w-4" /> 書き出す
          </button>
        ) : (
          <button disabled={batch.running} onClick={() => setBatchOpen(true)} className="inline-flex min-h-[44px] flex-shrink-0 items-center justify-center gap-2 rounded-[var(--r-sm)] bg-doya-500 px-5 text-sm font-black text-white shadow-lg shadow-doya-500/30 disabled:opacity-50">
            {batch.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {batch.running ? '作っています' : `面の画像をまとめて作る（${missing.length}面）`}
            {/* 減る量は、作る面の数ぶん（ドヤパワーの旗の内側だけ） */}
            <ShellCostBadge action="tenjikai.image" units={Math.max(1, missing.length)} />
          </button>
        )}
      </div>

      {batch.error && !batch.running && (
        <div className="rounded-[var(--r)] border border-gray-200 bg-white">
          <EmptyState
            compact
            tone={batch.error.tone === 'forbidden' ? 'forbidden' : batch.error.tone === 'error' ? 'error' : 'empty'}
            image={batch.error.tone === 'disabled' ? '/empty/preparing.svg' : undefined}
            title={batch.error.message}
            description={batch.done > 0 ? `${batch.done}面ぶんは3Dに貼りました。残りの面から作り直せます。` : undefined}
            action={batch.error.tone === 'error' ? { label: '残りの面を作る', onClick: () => void runBatch() } : batch.error.tone === 'forbidden' ? { label: 'ログインする', href: '/auth/signin?callbackUrl=%2Ftenjikai%2Fbooth' } : undefined}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-[var(--r-sm)] border border-gray-200 bg-white p-1">
          {plans.map((p) => (
            <button key={p.variant} onClick={() => { setVariant(p.variant); setSelectedId(undefined) }} className={clsx('relative min-h-[44px] flex-shrink-0 rounded-xl px-4 py-2 text-left', variant === p.variant ? 'text-white' : 'text-ink hover:bg-gray-50')}>
              {variant === p.variant && <motion.span layoutId="variantTab" className="absolute inset-0 rounded-xl bg-doya-500" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative block text-[11px] opacity-80">案 {p.variant}</span>
              <span className="relative block text-sm font-black">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 rounded-xl bg-gray-100 p-1 text-xs font-black" role="group" aria-label="表示の切り替え">
          {(['3d', 'iso', 'plan'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={clsx('min-h-[36px] rounded-lg px-3', view === v ? 'bg-white text-doya-600 shadow' : 'text-gray-500')}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div ref={threeRef} className="relative min-w-0 overflow-hidden rounded-[var(--r)] border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
            <h2 className="text-[15px] font-bold text-ink">3D完成予想図</h2>
            <span className="text-[12px] text-[var(--sub)]">面の画像 {madeCount}/{panels.length}</span>
          </div>
          <div className={clsx('aspect-[4/3] min-h-[280px] w-full', view !== '3d' && 'p-3')}>
            {view === '3d' ? (
              // 3D は入りのアニメーションで傾けない（傾いたまま倍率を測ると崩れるため）
              <Booth3D plan={plan} analysis={analysis} panels={panels} images={panelImages} selectedId={selectedId} onSelect={selectElement} selectedPanelId={panelId} onSelectPanel={selectPanel} />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={`${variant}-${view}`} initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full w-full">
                  {view === 'iso' ? <IsoBooth plan={plan} analysis={analysis} selectedId={selectedId} onSelect={selectElement} /> : <PlanView plan={plan} selectedId={selectedId} onSelect={selectElement} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 bg-amber-50/60 px-4 py-2.5 text-xs font-bold text-amber-800">
            <Footprints className="h-4 w-4 flex-shrink-0" />
            来場者の動線：{plan.flow}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-[var(--r)] border border-gray-200 bg-white p-5">
            <p className="text-[13px] font-medium text-doya-500">コンセプト</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{plan.concept}</p>
            <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-3">
              <span className="text-xs font-black text-gray-500">装飾・施工の概算</span>
              <CountUp value={cost.total} format={man} className="font-mono text-xl font-semibold text-ink tabular" />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-[12px] text-gray-500">
              <dt>部材</dt><dd className="text-right font-mono tabular">{yen(cost.parts)}</dd>
              <dt>床（カーペット）</dt><dd className="text-right font-mono tabular">{yen(cost.carpet)}</dd>
              <dt>デザイン費</dt><dd className="text-right font-mono tabular">{yen(cost.design)}</dd>
              <dt>施工費</dt><dd className="text-right font-mono tabular">{yen(cost.labor)}</dd>
            </dl>
          </div>

          <div className="rounded-[var(--r)] border border-gray-200 bg-white p-5">
            <p className="mb-2 text-[13px] font-medium text-gray-500">部材リスト（{plan.elements.length}点）</p>
            <ul className="flex flex-col gap-1">
              {plan.elements.map((e) => (
                <li key={`${variant}-${e.id}`}>
                  <button onClick={() => selectElement(e.id)} className={clsx('flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors', selectedId === e.id ? 'bg-amber-50 ring-2 ring-amber-300' : 'hover:bg-gray-50')}>
                    <span className="min-w-0 truncate font-bold text-ink">{e.label}</span>
                    <span className="flex-shrink-0 font-mono text-gray-500 tabular">{yen(e.costYen)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3 font-mono text-[12px] text-gray-600">
                W {Math.round(selected.w * 1000)} × D {Math.round(selected.d * 1000)} × H {Math.round(selected.h * 1000)} mm
                {selected.z ? ` / 設置高 ${Math.round(selected.z * 1000)} mm` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      <GraphicPlanner panels={panels} analysis={analysis} images={panelImages} selectedPanelId={panelId} onSelectPanel={selectPanel} onGenerate={setPanelTarget} />

      {/* 書き出し */}
      <div ref={exportRef} className="flex flex-col gap-4 rounded-[var(--r)] border border-gray-200 bg-white p-5 sm:flex-row sm:items-center">
        {madeCount === 0 ? (
          <figure className="overflow-hidden rounded-[var(--r-sm)] border border-gray-200 sm:w-64">
            <Image src="/tenjikai/booth-sample.webp" alt="完成したブースの見本" width={1600} height={1200} className="h-auto w-full" />
            <figcaption className="px-3 py-2 text-[12px] text-[var(--sub)]">完成のイメージ（見本）</figcaption>
          </figure>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-[18px] font-bold text-ink">書き出す</h2>
          <p className="text-[14px] leading-relaxed text-[var(--sub)]">グラフィックの割付表（CSV）と、作った面の画像を保存します。印刷会社への入稿の相談に使えます。</p>
          <div>
            <button disabled={madeCount === 0} onClick={() => void exportPack(plan, panels, panelImages)} className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border-2 border-doya-500 px-5 text-sm font-black text-doya-600 disabled:cursor-not-allowed disabled:opacity-40">
              <Download className="h-4 w-4" /> 割付表と画像を保存（{madeCount}面）
            </button>
            {madeCount === 0 && <p className="mt-1 text-[12px] text-[var(--muted)]">面の画像を作ると、保存できます。</p>}
          </div>
        </div>
      </div>

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="面の画像をまとめて作る">
        <div className="flex flex-col gap-4">
          <p className="text-[15px] leading-relaxed text-ink">まだ画像の無い {missing.length} 面ぶんを、1面ずつ順に作ります。できた面から、3Dの壁面に貼られます。</p>
          {left && <p className="text-[13px] text-[var(--sub)]">{left}</p>}
          {notEnough && <p className="rounded-[var(--r-sm)] bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">きょう作れる残りが足りません。作れる面まで作り、残りは明日作れます。</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setBatchOpen(false)} className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-gray-500 hover:bg-gray-100">キャンセル</button>
            <button onClick={() => void runBatch()} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-doya-500 px-5 text-sm font-black text-white">
              <ImagePlus className="h-4 w-4" /> 作りはじめる
            </button>
          </div>
        </div>
      </Modal>

      {panelTarget && (
        <ImageGenModal
          open={!!panelTarget}
          onClose={() => setPanelTarget(null)}
          kind="graphic_panel"
          title={`${panelTarget.name}の画像を作る`}
          prompt={buildPanelPrompt(panelTarget, analysis)}
          aspectRatio={nearestRatio(panelTarget.widthMm, panelTarget.heightMm)}
          onResult={(imgs) => imgs[0] && setPanelImages((m) => ({ ...m, [panelTarget.id]: imgs[0] }))}
        />
      )}
    </div>
  )
}
