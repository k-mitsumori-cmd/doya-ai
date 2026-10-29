'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { AlertCircle, Check, Circle, Download, Footprints, ImagePlus, Loader2, Ruler } from 'lucide-react'
import IsoBooth from './IsoBooth'
import Booth3D from './Booth3D'
import GraphicPlanner from './GraphicPlanner'
import ImageGenModal from './ImageGenModal'
import EmptyState from './EmptyState'
import BoothSizeInput from './BoothSizeInput'
import { CountUp, Modal, PageHeader } from './ui'
import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'
import { IMAGEGEN_DISABLED_MESSAGE, isImageGenDisabled, remainingLabel, requestImages, useImageQuota, type ImageGenFailure } from './useImageGen'
import { nearestRatio } from '@/lib/tenjikai/imagegen'
import { buildPanelPrompt, generateGraphicPlan, type GraphicPanel } from '@/lib/tenjikai/graphics'
import { cropImageToAspect, toReferencePng } from '@/lib/tenjikai/image-fit'
import type { BoothDesignKit } from '@/lib/tenjikai/design-kit'
import DesignKitStudio from './DesignKitStudio'
import { batchSummary, runPanelBatch, type BatchFace } from '@/lib/tenjikai/batch'
import DoyaWorking from '@/components/shell/DoyaWorking'
import { KIND_LABEL, man, planCost, yen, type BoothPlan, type ProjectInput, type SiteAnalysis } from '@/lib/tenjikai/engine'
import { ds } from '@/lib/tenjikai/tokens'
import Image from 'next/image'
import { ShellCostBadge } from '@/components/shell/power'
import { FlowSteps, NextStepAction, NextStepBar } from '@/components/ds/next-step'

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
  /** 小間の横と奥行を変える（3D と面の数・大きさが変わる）。作った面の画像は外す */
  onResize?: (widthM: number, depthM: number) => void
  /** ブースのデザインの決まり（仕様 4 章）と、確定したか。確定するまで、画像は作れない */
  kit: BoothDesignKit
  kitConfirmed: boolean
  onKitChange: (kit: BoothDesignKit) => void
  onKitConfirm: () => void
  onKitReopen: () => void
}

const KIT_NEEDED_MESSAGE = '先に、上の「ブースのデザインの決まり」を確定してください。確定した決まりで、すべての面を同じに作ります。'

const VIEW_LABEL = { '3d': '3D', iso: '等角模型', plan: '平面図' } as const

// 利用者の流れ（2026-10-19 ユーザー指示）: 条件を入れる → 3D で確かめる → 面の画像を作る（3D に貼られる） → 書き出す
const FLOW = ['条件を入れる', '3Dで確かめる', '面の画像を作る', '書き出す'] as const

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

export default function BoothStudio({ plans, variant, setVariant, input, analysis, panelImages, setPanelImages, onResize, kit, kitConfirmed, onKitChange, onKitConfirm, onKitReopen }: StudioProps) {
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
  // まとめて作るときの、面ごとの状態（待ち・作成中・完成・失敗・作っていない）と理由
  const [faces, setFaces] = useState<BatchFace[]>([])
  const [stopReason, setStopReason] = useState<ImageGenFailure>()
  const summary = batchSummary(faces)
  const running = summary.running
  // 小間の大きさの下書き（「この大きさにする」で反映する）
  const [sizeDraft, setSizeDraft] = useState<{ w: number; d: number }>({ w: plan.widthM, d: plan.depthM })
  useEffect(() => setSizeDraft({ w: plan.widthM, d: plan.depthM }), [plan.widthM, plan.depthM])
  const [sizeOk, setSizeOk] = useState(true)
  const onSizeValid = useCallback((ok: boolean) => setSizeOk(ok), [])
  const threeRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  // 見本（マスター）: 背面壁の中央の画像
  const heroPanel = panels.find((p) => p.layout === 'hero')
  const heroImage = heroPanel ? panelImages[heroPanel.id] : undefined
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

  // まだ画像の無い面を、1面ずつ順に作る。できた面から 3D に貼られる。
  // 押したら、確認の画面（画面の真ん中）のまま「作り始めました」と面ごとの進み具合・失敗の理由を出す（2026-10-26 ユーザーの指摘）。
  // ⚠️ 前は確認の画面を閉じて 3D へ移っていたため、進み具合や「準備中」の知らせが画面の外に出て、作っているのか分からなかった
  const runBatch = async (targets: GraphicPanel[] = missing) => {
    if (targets.length === 0) return
    setBatchOpen(true)
    setView('3d')
    setStopReason(undefined)
    // 見本（マスター）を先に作り、残りの面は、見本を参照して作る（仕様 5 章）。すでに見本があれば、それを参照にする
    const ordered = [...targets].sort((a, b) => Number(b.layout === 'hero') - Number(a.layout === 'hero'))
    const heroNow = panels.find((p) => p.layout === 'hero')
    let masterRef: string | undefined = heroNow && panelImages[heroNow.id] ? await toReferencePng(panelImages[heroNow.id]) : undefined
    const stop = await runPanelBatch(
      ordered,
      async (p) => {
        const r = await requestImages({
          prompt: buildPanelPrompt(p, analysis, kit, { hasReference: !!masterRef && p.layout !== 'hero' }),
          aspectRatio: nearestRatio(p.widthMm, p.heightMm),
          kind: 'graphic_panel',
          referencePng: p.layout !== 'hero' ? masterRef : undefined,
        })
        if (!r.ok || !r.images[0]) return r
        // 面の実寸の縦横比に切り出して保存する（3D の面に、切れずに貼るため。仕様 6 章）
        const fitted = await cropImageToAspect(r.images[0], p.widthMm / p.heightMm)
        if (p.layout === 'hero') masterRef = await toReferencePng(fitted)
        return { ok: true as const, images: [fitted] }
      },
      { onUpdate: setFaces, onImage: (p, img) => setPanelImages((m) => ({ ...m, [p.id]: img })) },
    )
    setStopReason(stop)
    void refresh()
  }

  const left = remainingLabel(quota)
  const notEnough = quota?.enabled && quota.remaining !== null && quota.remaining < missing.length
  // サーバーが画像の生成を止めている（TENJIKAI_IMAGEGEN_ENABLED が未設定）。押す前から分かるように出す
  const disabled = isImageGenDisabled(quota)
  // 決まりを確定するまでは、画像を作らせない（面ごとに色や形がばらばらになるのを防ぐ。2026-10-29）
  const kitBlocked = !kitConfirmed
  const blocked = disabled || kitBlocked
  const failedPanels = panels.filter((p) => !panelImages[p.id] && faces.some((f) => f.id === p.id && (f.status === 'failed' || f.status === 'skipped')))
  const sizeChanged = sizeDraft.w !== plan.widthM || sizeDraft.d !== plan.depthM
  // 旗 ONE_BUTTON_ROLLOUT が on の人には、上の帯を「これ1つで全部進む」形にする（ドヤくん＋大きなボタン1つ）
  const oneButton = useOneButton()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      {oneButton ? (
        <OneButtonBar
          eyebrow="ブース設計"
          cta={allMade ? 'すべての面ができました。書き出して、印刷会社に渡せます' : running ? '面の画像を作っています。このまま待ってね' : 'ブースの形と大きさが決まったら、押してね'}
          label={allMade ? '書き出す' : running ? `進み具合を見る（${summary.finished}/${summary.total}面）` : `面の画像をまとめて作る（${missing.length}面）`}
          scope={allMade
            ? '3Dの完成図・割付表・面の画像を、まとめて書き出します。'
            : `まだ画像の無い${missing.length}面を、1面ずつ作ります。できた面から3Dの壁に貼られます。${left ? `（${left}）` : ''}`}
          onRun={allMade ? () => void exportPack(plan, panels, panelImages) : running ? () => setBatchOpen(true) : () => { setFaces([]); setStopReason(undefined); setBatchOpen(true) }}
          disabled={!allMade && !running && blocked}
          disabledReason={kitBlocked && !disabled ? KIT_NEEDED_MESSAGE : IMAGEGEN_DISABLED_MESSAGE}
          running={running}
          // 作っている間に押すと、進み具合の画面を開く（新しく作り始めはしない）
          clickableWhileRunning
          progress={running ? { done: summary.finished, total: summary.total } : undefined}
          pose={allMade ? 'success' : undefined}
          extra={!allMade && !running ? <ShellCostBadge action="tenjikai.image" units={Math.max(1, missing.length)} /> : undefined}
        />
      ) : (
        <PageHeader title="ブース設計" desc="出展の目的と小間の位置から、3つの設営案を作りました。3Dはドラッグで回せます。面の画像を作ると、3Dの壁面に貼られます。" />
      )}

      <FlowSteps steps={FLOW} current={step} label="ブース設計の進め方" />

      {/* ブースのデザインの決まり。先に決める（確定するまで、画像は作れない） */}
      <DesignKitStudio kit={kit} confirmed={kitConfirmed} onChange={onKitChange} onConfirm={onKitConfirm} onReopen={onKitReopen} madeCount={madeCount} />

      {/* 次にやること（ds/next-step。ほかのツールの帯も同じ部品）。上の帯（ONE_BUTTON）が出ているときは、同じボタンが二重になるので出さない */}
      {oneButton ? null : <NextStepBar
        state={allMade ? 'done' : running ? 'working' : blocked || summary.failed > 0 ? 'error' : 'empty'}
        text={
          allMade
            ? 'すべての面に画像を貼りました。書き出して、印刷会社に渡せます。'
            : running
              ? `面の画像を作っています（${summary.finished}/${summary.total}面）。できた面から3Dに貼られます。`
              : blocked
                ? (kitBlocked && !disabled ? KIT_NEEDED_MESSAGE : IMAGEGEN_DISABLED_MESSAGE)
                : `次は、面の画像を作ります（${madeCount}/${panels.length}面が完成）。`
        }
        sub={left && !allMade ? left : undefined}
        action={allMade ? (
          <NextStepAction onClick={() => void exportPack(plan, panels, panelImages)} iconNode={<Download className="h-4 w-4" aria-hidden />}>
            書き出す
          </NextStepAction>
        ) : running ? (
          <NextStepAction onClick={() => setBatchOpen(true)} iconNode={<Loader2 className="h-4 w-4 animate-spin" aria-hidden />}>
            進み具合を見る（{summary.finished}/{summary.total}面）
          </NextStepAction>
        ) : (
          <NextStepAction onClick={() => { setFaces([]); setStopReason(undefined); setBatchOpen(true) }} iconNode={<ImagePlus className="h-4 w-4" aria-hidden />}>
            {`面の画像をまとめて作る（${missing.length}面）`}
            {/* 減る量は、作る面の数ぶん（ドヤパワーの旗の内側だけ） */}
            <ShellCostBadge action="tenjikai.image" units={Math.max(1, missing.length)} />
          </NextStepAction>
        )}
      />}

      {/* 確認の画面を閉じたあとも、作れなかった面があれば知らせる */}
      {!running && !batchOpen && summary.failed > 0 && (
        <div className="rounded-[var(--r)] border border-gray-200 bg-white">
          <EmptyState
            compact
            tone={stopReason?.tone === 'forbidden' ? 'forbidden' : 'error'}
            image={stopReason?.tone === 'disabled' ? '/empty/preparing.svg' : undefined}
            title={stopReason?.message ?? `${summary.failed}面は作れませんでした。`}
            description={summary.done > 0 ? `${summary.done}面ぶんは3Dに貼りました。` : undefined}
            action={stopReason?.tone === 'forbidden' ? { label: 'ログインする', href: '/auth/signin?callbackUrl=%2Ftenjikai%2Fbooth' } : { label: '面ごとの結果を見る', onClick: () => setBatchOpen(true) }}
          />
        </div>
      )}

      {/* 小間の大きさ。変えると 3D と面の数・大きさが変わる（2026-10-26 ユーザー指示） */}
      {onResize && (
        <section className="flex flex-col gap-3 rounded-[var(--r)] border border-gray-200 bg-white p-5 lg:flex-row lg:items-end lg:justify-between" aria-label="小間の大きさ">
          <BoothSizeInput label="小間の大きさ（3Dと面の数は、この大きさで決まります）" widthM={sizeDraft.w} depthM={sizeDraft.d} onChange={(w, d) => setSizeDraft({ w, d })} onValidChange={onSizeValid} />
          <div className="flex flex-col items-start gap-1 lg:items-end">
            {sizeChanged && madeCount > 0 && <p className="text-[12px] font-bold text-amber-800">大きさを変えると、作った面の画像（{madeCount}面）は外れます。先に書き出しておけます。</p>}
            <button
              type="button"
              disabled={!sizeOk || !sizeChanged || running}
              onClick={() => {
                onResize(sizeDraft.w, sizeDraft.d)
                setFaces([])
                setStopReason(undefined)
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border-2 border-doya-500 px-5 text-sm font-black text-doya-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ruler className="h-4 w-4" aria-hidden /> この大きさにする
            </button>
          </div>
        </section>
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
        {faces.length === 0 ? (
          <div className="flex flex-col gap-4" data-batch-state="confirm">
            <p className="text-[15px] leading-relaxed text-ink">まだ画像の無い {missing.length} 面ぶんを、1面ずつ順に作ります。できた面から、3Dの壁面に貼られます。</p>
            {disabled && (
              <p role="alert" className="rounded-[var(--r-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">{IMAGEGEN_DISABLED_MESSAGE}</p>
            )}
            {kitBlocked && <p role="alert" className="rounded-[var(--r-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">{KIT_NEEDED_MESSAGE}</p>}
            {left && <p className="text-[13px] text-[var(--sub)]">{left}</p>}
            {notEnough && <p className="rounded-[var(--r-sm)] bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">きょう作れる残りが足りません。作れる面まで作り、残りは明日作れます。</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBatchOpen(false)} className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-gray-500 hover:bg-gray-100">キャンセル</button>
              <button type="button" disabled={blocked || missing.length === 0} onClick={() => void runBatch()} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-doya-500 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                <ImagePlus className="h-4 w-4" /> 作りはじめる
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4" data-batch-state={running ? 'running' : 'finished'}>
            <div aria-live="polite" aria-atomic="true">
              <p className="text-[15px] font-bold text-ink">
                {running
                  ? `作り始めました。${summary.finished}/${summary.total}面が終わりました。`
                  : summary.failed === 0
                    ? `${summary.done}面の画像を作りました。3Dの壁面に貼っています。`
                    : `${summary.done}面を作り、${summary.failed}面は作れませんでした。`}
              </p>
              {running && <p className="mt-1 text-[13px] text-[var(--sub)]">1面ずつ作ります。この画面を閉じても、作り続けます。</p>}
            </div>
            {/* ドヤくんが壁を塗る待ち画面。塗る高さは、終わった面の割合（2026-10-29 ユーザー「待ち時間にも遊び心を」） */}
            <DoyaWorking
              compact
              title={running ? 'ドヤくんが面の画像を作っています' : summary.failed === 0 ? 'すべての面ができました' : '作れた面だけ、できました'}
              caption={running ? 'できた面から、3Dの壁面に貼られます。' : undefined}
              steps={running ? ['ブースの決まりの色で、1面ずつ塗っています', '面どうしの色と形をそろえています', '見出しの場所を空けています'] : undefined}
              colors={{ primary: kit.palette.primary, secondary: kit.palette.dark, accent: kit.palette.accent }}
              progress={summary.total ? summary.finished / summary.total : 0}
              done={!running && summary.failed === 0}
            />
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="面の画像の進み具合" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.finished}>
              <div className="h-full rounded-full bg-doya-500 transition-[width] duration-300" style={{ width: `${summary.total ? (summary.finished / summary.total) * 100 : 0}%` }} />
            </div>
            <ul className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto" aria-label="面ごとの状態">
              {faces.map((f) => {
                const bad = f.status === 'failed' || f.status === 'skipped'
                return (
                  <li key={f.id} data-face-status={f.status} className={clsx('flex items-start gap-2 rounded-[var(--r-sm)] border px-3 py-2', bad ? 'border-rose-200 bg-rose-50' : f.status === 'done' ? 'border-emerald-200 bg-emerald-50' : f.status === 'working' ? 'border-doya-200 bg-doya-50' : 'border-gray-200 bg-white')}>
                    <span className="mt-0.5 flex-shrink-0">
                      {f.status === 'working' ? <Loader2 className="h-4 w-4 animate-spin text-doya-600" aria-hidden /> : f.status === 'done' ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : f.status === 'waiting' ? <Circle className="h-4 w-4 text-gray-300" aria-hidden /> : <AlertCircle className="h-4 w-4 text-rose-600" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-ink">{f.name}</span>
                      <span className={clsx('block text-[12px]', bad ? 'font-bold text-rose-700' : 'text-[var(--sub)]')}>
                        {f.status === 'working' ? '作っています' : f.status === 'done' ? 'できました' : f.status === 'waiting' ? '順番を待っています' : f.message}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              {stopReason?.tone === 'forbidden' && (
                <a href="/auth/signin?callbackUrl=%2Ftenjikai%2Fbooth" className="inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-bold text-doya-600 hover:bg-doya-50">ログインする</a>
              )}
              {!running && failedPanels.length > 0 && !disabled && (stopReason === undefined || stopReason.tone === 'error') && (
                <button type="button" onClick={() => void runBatch(failedPanels)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-doya-500 px-4 text-sm font-black text-doya-600">
                  <ImagePlus className="h-4 w-4" /> 作れなかった面をもう一度（{failedPanels.length}面）
                </button>
              )}
              <button type="button" onClick={() => setBatchOpen(false)} className="inline-flex min-h-[44px] items-center rounded-xl bg-doya-500 px-5 text-sm font-black text-white">
                {running ? '閉じる（作り続けます）' : '閉じる'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {panelTarget && (
        <ImageGenModal
          open={!!panelTarget}
          onClose={() => setPanelTarget(null)}
          kind="graphic_panel"
          title={`${panelTarget.name}の画像を作る`}
          colors={{ primary: kit.palette.primary, secondary: kit.palette.dark, accent: kit.palette.accent }}
          blockedReason={kitBlocked ? KIT_NEEDED_MESSAGE : undefined}
          prompt={buildPanelPrompt(panelTarget, analysis, kit, { hasReference: panelTarget.layout !== 'hero' && !!heroImage })}
          aspectRatio={nearestRatio(panelTarget.widthMm, panelTarget.heightMm)}
          getReference={panelTarget.layout !== 'hero' && heroImage ? () => toReferencePng(heroImage) : undefined}
          onResult={async (imgs) => {
            if (!imgs[0]) return
            const fitted = await cropImageToAspect(imgs[0], panelTarget.widthMm / panelTarget.heightMm)
            setPanelImages((m) => ({ ...m, [panelTarget.id]: fitted }))
          }}
        />
      )}
    </div>
  )
}
