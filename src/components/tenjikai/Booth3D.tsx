'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { clsx } from 'clsx'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import type { BoothElement, BoothPlan, SiteAnalysis } from '@/lib/tenjikai/engine'
import type { GraphicPanel, GraphicZone } from '@/lib/tenjikai/graphics'
import { ds } from '@/lib/tenjikai/tokens'
import { contrast } from '@/lib/tenjikai/design-kit'
import { isLegacyImage } from '@/lib/tenjikai/local-store'

// CSS 3D でブースを組み立てる。1m = S px。床は XY 平面、高さは translateZ。
const S = 64

const VIEWS = {
  diagonal: { label: '斜め', pitch: 60, yaw: -32 },
  front: { label: '正面', pitch: 78, yaw: 0 },
  side: { label: '側面', pitch: 70, yaw: 62 },
  top: { label: '真上', pitch: 0, yaw: 0 },
} as const
type ViewKey = keyof typeof VIEWS

const BODY: Record<BoothElement['kind'], { top: string; side: string; front: string }> = {
  wall: { top: ds.surface2, side: ds.line, front: ds.paper },
  monitor: { top: '#3a3550', side: '#25203a', front: '#15121f' },
  counter: { top: ds.paper, side: ds.lineStrong, front: ds.track },
  table: { top: '#f7e7c6', side: '#c9a96b', front: '#e2c48c' },
  demo: { top: ds.blueSoft, side: ds.k1, front: ds.blueLine },
  rollup: { top: ds.paper, side: ds.navy, front: ds.blue },
  storage: { top: ds.track, side: ds.muted, front: ds.lineStrong },
  sign: { top: ds.blue, side: ds.navy, front: ds.blueDeep },
}

function zoneColor(z: GraphicZone, a: SiteAnalysis) {
  return z.tone === 'primary' ? a.colors.primary : z.tone === 'secondary' ? a.colors.secondary : z.tone === 'light' ? ds.paper : `${a.colors.primary}22`
}

/** 背景の上に置く文字の色。白と暗色のうち、対比が高いほう（読めない色の組を作らない） */
function readableOn(bg: string, dark: string): string {
  const base = /^#[0-9a-fA-F]{6}/.test(bg) ? bg.slice(0, 7) : '#ffffff'
  return contrast(base, '#ffffff') >= contrast(base, dark) ? '#ffffff' : dark
}

/** 文字数に合わせて字を小さくする（切らずに、枠に収める） */
const fitSize = (len: number, wCqw: number, hCqh: number) => `calc(min(${wCqw}cqw, ${hCqh}cqh) * ${Math.max(0.45, Math.min(1, 8 / Math.max(1, len))).toFixed(2)})`

// 面の表示。画像があるときは、画像だけを貼る（文字も含めた完成品の1枚。2026-10-29 ユーザー「文字も含めて画像で」）。
// 画像は、面の実寸の縦横比に切り出して保存してあるので、object-cover のままで切れない。画像の上に見出しは重ねない（読めない・切れる原因だった）。
// 画像がないとき（作る前）は、割付どおりの簡易の絵を出す。文字の色は背景から決め、切らずに収める。
export function PanelArt({ p, a, image, compact, legacy }: { p: GraphicPanel; a: SiteAnalysis; image?: string; compact?: boolean; legacy?: boolean }) {
  if (image) {
    // 文字を含まない昔の画像（2026-10-29 より前に作ったもの）だけは、見出しを重ねて出す。暗い帯の上に白い字を置くので、背景が明るくても読める。切らずに、枠に合わせて縮める
    const headline = legacy && !compact ? p.headline || a.brand : ''
    return (
      <div className="relative h-full w-full overflow-hidden" style={headline ? { containerType: 'size' } : undefined}>
        <img src={image} alt={`${p.name}のグラフィック`} className="h-full w-full object-cover" draggable={false} />
        {headline ? (
          <div className="absolute inset-x-0 top-0 flex h-[30%] items-center justify-center px-[6%] text-center text-white" style={{ background: 'linear-gradient(rgba(10,15,60,.62), rgba(10,15,60,0))' }}>
            <span className="font-black leading-tight [overflow-wrap:anywhere] [text-wrap:balance]" style={{ fontSize: fitSize([...headline].length, 12, 16) }}>{headline}</span>
          </div>
        ) : null}
      </div>
    )
  }
  const H = p.heightMm
  const dark = a.colors.secondary
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ containerType: 'size' }}>
      {[...p.zones].sort((x, y) => y.toMm - x.toMm).map((z) => {
        const top = ((H - Math.min(H, z.toMm)) / H) * 100
        const height = ((Math.min(H, z.toMm) - z.fromMm) / H) * 100
        const bg = zoneColor(z, a)
        const isHead = z.label === '上段' || z.label === '全面'
        const text = isHead ? p.headline || a.brand : z.content
        return (
          <div key={z.label} className="absolute inset-x-0 flex items-center justify-center px-[6%] text-center" style={{ top: `${top}%`, height: `${height}%`, background: bg, color: readableOn(bg, dark) }}>
            {!compact && z.tone !== 'muted' && (
              <span className="font-black leading-tight [overflow-wrap:anywhere] [text-wrap:balance]" style={{ fontSize: isHead ? fitSize([...text].length, 16, 22) : fitSize([...text].length, 8, 10) }}>
                {text}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface Props {
  plan: BoothPlan
  analysis: SiteAnalysis
  panels: GraphicPanel[]
  images: Record<string, string>
  selectedId?: string
  onSelect?: (id: string) => void
  selectedPanelId?: string
  onSelectPanel?: (id: string) => void
  /** 文字を含まない昔の画像の目印（local-store.ts）。その面には、見出しを重ねて出す */
  legacySig?: Record<string, string>
}

export default function Booth3D({ plan, analysis, panels, images, selectedId, onSelect, selectedPanelId, onSelectPanel, legacySig }: Props) {
  const W = plan.widthM * S
  const D = plan.depthM * S
  // 最初から斜めの視点で出す（回り込む演出は、アニメーションが止まる環境で変な角度のまま残るのでやめた）
  const pitch = useMotionValue<number>(VIEWS.diagonal.pitch)
  const yaw = useMotionValue<number>(VIEWS.diagonal.yaw)
  const zoom = useMotionValue(1)
  const sp = useSpring(pitch, { stiffness: 120, damping: 22 })
  const sy = useSpring(yaw, { stiffness: 120, damping: 22 })
  // 倍率はばねを通さずにそのまま当てる（枠に合わせた倍率が、すぐに反映されるように）
  const sz = zoom
  const transform = useMotionTemplate`rotateX(${sp}deg) rotateZ(${sy}deg) scale3d(${sz}, ${sz}, ${sz})`
  const wallH = Math.max(2.7, ...plan.elements.map((e) => (e.z ?? 0) + e.h)) * S
  // 壁が立ち上がるぶん絵の重心が上がるので、視点の角度に合わせて下へずらす
  const top = useTransform([sp, sz], ([p, z]: number[]) => `calc(50% + ${(wallH * z * Math.sin((p * Math.PI) / 180)) / 2}px)`)
  const [view, setView] = useState<ViewKey | null>('diagonal')
  const drag = useRef<{ x: number; y: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // 案を切り替えたら、斜めの視点に戻す
  useEffect(() => {
    pitch.set(VIEWS.diagonal.pitch)
    yaw.set(VIEWS.diagonal.yaw)
    setView('diagonal')
  }, [plan.variant, pitch, yaw])

  // 小間の大きさと枠の大きさから倍率を決める。枠の大きさが変わるたびに合わせ直す（画面幅を変えても崩れない）
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const fitNow = () => {
      if (!el.clientWidth || !el.clientHeight) return
      const diag = Math.hypot(W, D)
      const fit = Math.min(el.clientWidth / (diag * 1.2), el.clientHeight / ((diag * 0.6 + wallH) * 1.25))
      // 30m 角の大きなブースでも枠に収まるよう、下限を小さくしている（小間の大きさは利用者が 1〜30m で入れる）
      zoom.set(Math.max(0.05, Math.min(1.6, fit)))
    }
    fitNow()
    const ro = new ResizeObserver(fitNow)
    ro.observe(el)
    return () => ro.disconnect()
  }, [W, D, wallH, zoom])

  const go = (k: ViewKey) => {
    setView(k)
    pitch.set(VIEWS[k].pitch)
    yaw.set(VIEWS[k].yaw)
  }

  const panelsOf = (id: string) => panels.filter((p) => p.elementId === id)
  const komaX = Math.max(1, Math.round(plan.widthM / 2.9))
  const komaY = Math.max(1, Math.round(plan.depthM / 2.9))

  return (
    <div
      ref={boxRef}
      className="relative h-full w-full select-none overflow-hidden"
      // スマホでは縦のスクロールを止めない（指を横に動かすと回る。上下の角度は「正面」「真上」で変える）
      style={{ perspective: 2400, touchAction: 'pan-y', cursor: drag.current ? 'grabbing' : 'grab', background: `radial-gradient(ellipse at 50% 40%, ${ds.paper} 0%, ${ds.track} 70%)` }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        drag.current = { x: e.clientX, y: e.clientY }
        yaw.set(yaw.get() + dx * 0.35)
        if (e.pointerType !== 'touch') pitch.set(Math.max(0, Math.min(85, pitch.get() - dy * 0.3)))
        setView(null)
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <motion.div
        className="absolute left-1/2"
        style={{ top, width: W, height: D, marginLeft: -W / 2, marginTop: -D / 2, transformStyle: 'preserve-3d', transform }}
      >
        {/* 通路 */}
        <div className="absolute" style={{ left: -1.2 * S, top: D, width: W + 2.4 * S, height: 1.8 * S, background: ds.line }} />
        <div className="absolute" style={{ left: W, top: -1.2 * S, width: 1.8 * S, height: D + 1.2 * S, background: ds.line }} />
        <div className="absolute whitespace-nowrap font-mono text-[11px] font-semibold text-gray-500" style={{ left: W / 2 - 40, top: D + 0.7 * S }}>メイン通路</div>

        {/* 床（カーペット） */}
        {/* 入りのアニメーションを付けない（止まる環境で薄いまま残るため。F-12 と同じ理由） */}
        <motion.div
          className="absolute inset-0 border-2 border-doya-500"
          style={{ background: `repeating-linear-gradient(45deg, ${ds.blueSoft} 0 6px, ${ds.bar} 6px 12px)` }}
        >
          {Array.from({ length: komaX - 1 }).map((_, i) => (
            <div key={`kx${i}`} className="absolute inset-y-0 border-l-2 border-dashed border-doya-200" style={{ left: ((i + 1) * W) / komaX }} />
          ))}
          {Array.from({ length: komaY - 1 }).map((_, i) => (
            <div key={`ky${i}`} className="absolute inset-x-0 border-t-2 border-dashed border-doya-200" style={{ top: ((i + 1) * D) / komaY }} />
          ))}
        </motion.div>

        {/* 寸法 */}
        <div className="absolute flex items-center justify-center whitespace-nowrap font-mono text-[12px] font-semibold text-doya-700" style={{ left: 0, top: D + 6, width: W }}>
          ← {Math.round(plan.widthM * 1000).toLocaleString()} mm →
        </div>
        <div className="absolute flex items-center justify-center font-mono text-[12px] font-semibold text-doya-700" style={{ left: W + 6, top: 0, height: D, width: 24, writingMode: 'vertical-rl' }}>
          ← {Math.round(plan.depthM * 1000).toLocaleString()} mm →
        </div>

        {plan.elements.map((e, i) => (
          <Box
            key={`${plan.variant}-${e.id}`}
            e={e}
            i={i}
            a={analysis}
            panels={panelsOf(e.id)}
            images={images}
            legacySig={legacySig}
            selected={selectedId === e.id}
            selectedPanelId={selectedPanelId}
            onSelect={onSelect}
            onSelectPanel={onSelectPanel}
          />
        ))}

        {/* 人物スケール（身長170cm） */}
        <Person x={plan.widthM * 0.62} y={plan.depthM + 0.6} />
        <Person x={plan.widthM * 0.2} y={plan.depthM + 1.0} tone={ds.muted} />
      </motion.div>

      {/* 操作 */}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 rounded-xl bg-white/90 p-1 shadow-sm backdrop-blur sm:bottom-auto sm:left-3 sm:top-3" onPointerDown={(e) => e.stopPropagation()}>
        {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
          <button key={k} onClick={() => go(k)} aria-pressed={view === k} className={clsx('min-h-[36px] rounded-lg px-2.5 text-[12px] font-black', view === k ? 'bg-doya-500 text-white' : 'text-gray-600 hover:bg-gray-100')}>
            {VIEWS[k].label}
          </button>
        ))}
      </div>
      <div className="absolute right-2 top-2 flex gap-1 rounded-xl bg-white/90 p-1 shadow-sm backdrop-blur sm:right-3 sm:top-3" onPointerDown={(e) => e.stopPropagation()}>
        <button aria-label="縮小" onClick={() => zoom.set(Math.max(0.05, zoom.get() * 0.85))} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"><Minus className="h-3.5 w-3.5" /></button>
        <button aria-label="拡大" onClick={() => zoom.set(Math.min(2.4, zoom.get() * 1.18))} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"><Plus className="h-3.5 w-3.5" /></button>
        <button aria-label="視点を戻す" onClick={() => go('diagonal')} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"><RotateCcw className="h-3.5 w-3.5" /></button>
      </div>
      <p className="pointer-events-none absolute bottom-3 right-3 hidden text-[11px] font-bold text-gray-500 sm:block">ドラッグで回転します。壁面を押すと、その面の割付を表示します</p>
    </div>
  )
}

function Person({ x, y, tone = ds.sub }: { x: number; y: number; tone?: string }) {
  const h = 1.7 * S
  return (
    <div className="pointer-events-none absolute" style={{ left: x * S, top: y * S, width: 0.45 * S, height: 0, transformStyle: 'preserve-3d' }}>
      <div className="absolute" style={{ left: 0, top: -h, width: 0.45 * S, height: h, transformOrigin: 'bottom', transform: 'rotateX(-90deg)' }}>
        <svg viewBox="0 0 30 110" className="h-full w-full" aria-hidden="true">
          <circle cx="15" cy="9" r="8" fill={tone} />
          <path d="M4 22 Q15 16 26 22 L24 62 L21 108 L16 108 L15 70 L14 108 L9 108 L6 62 Z" fill={tone} />
        </svg>
      </div>
    </div>
  )
}

function Box({ e, i, a, panels, images, legacySig, selected, selectedPanelId, onSelect, onSelectPanel }: { e: BoothElement; i: number; a: SiteAnalysis; panels: GraphicPanel[]; images: Record<string, string>; legacySig?: Record<string, string>; selected: boolean; selectedPanelId?: string; onSelect?: (id: string) => void; onSelectPanel?: (id: string) => void }) {
  const w = e.w * S
  const d = e.d * S
  const h = e.h * S
  const z = (e.z ?? 0) * S
  const c = BODY[e.kind]
  const ring = selected ? `0 0 0 2px ${ds.yellow} inset` : undefined
  const face = 'absolute' as const
  const bf = { backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const }
  const frontPanels = panels.filter((p) => p.face === 'front')
  const sidePanels = panels.filter((p) => p.face === 'side')

  const panelLayer = (list: GraphicPanel[], lengthPx: number) =>
    list.map((p) => {
      const left = (p.offsetMm / 1000) * S
      const width = (p.widthMm / 1000) * S
      // 面の高さと床からの位置を、部材の高さの中に置く（前は部材の高さいっぱいに引き伸ばし、面どうしが重なって見えていた）
      const panelH = Math.min(h, (p.heightMm / 1000) * S)
      const panelTop = Math.max(0, h - ((p.baseMm + p.heightMm) / 1000) * S)
      const active = selectedPanelId === p.id
      return (
        <button
          key={p.id}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => {
            ev.stopPropagation()
            onSelectPanel?.(p.id)
          }}
          className="absolute overflow-hidden"
          style={{ left: Math.min(left, lengthPx), width: Math.max(0, Math.min(width, lengthPx - Math.min(left, lengthPx))), top: panelTop, height: panelH, outline: active ? `3px solid ${ds.yellow}` : '1px solid rgba(16,22,51,.15)', outlineOffset: -2 }}
          title={p.name}
        >
          <PanelArt p={p} a={a} image={images[p.id]} legacy={isLegacyImage(legacySig, p.id, images[p.id])} />
          {active && <motion.div className="absolute inset-0 bg-amber-300/30" animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 1.4, repeat: Infinity }} />}
        </button>
      )
    })

  return (
    <motion.div
      className="absolute"
      style={{ left: e.x * S, top: e.y * S, width: w, height: d, transformStyle: 'preserve-3d' }}
      // 最初から置いた位置に出す（上から降ろす演出は、アニメーションが止まる環境で部材が浮いたまま残るのでやめた）
      initial={false}
      animate={{ z }}
      transition={{ type: 'spring', stiffness: 140, damping: 16 }}
      onClick={() => onSelect?.(e.id)}
    >
      {/* 天面 */}
      <div className={face} style={{ ...bf, inset: 0, background: c.top, transform: `translateZ(${h}px)`, boxShadow: ring }} />
      {/* 背面（-y） */}
      <div className={face} style={{ ...bf, left: 0, top: 0, width: w, height: h, background: c.side, transformOrigin: 'top', transform: 'rotateX(90deg)' }} />
      {/* 左面（-x） */}
      <div className={face} style={{ ...bf, left: 0, top: 0, width: h, height: d, background: c.side, transformOrigin: 'left', transform: 'rotateY(-90deg)' }} />
      {/* 右面（+x） */}
      <div className={face} style={{ ...bf, left: w - h, top: 0, width: h, height: d, background: c.side, transformOrigin: 'right', transform: 'rotateY(90deg)', boxShadow: ring }}>
        {sidePanels.length > 0 && (
          <div className="absolute" style={{ left: 0, top: 0, width: d, height: h, transformOrigin: '0 0', transform: `translateY(${d}px) rotate(-90deg)` }}>
            {panelLayer(sidePanels, d)}
          </div>
        )}
      </div>
      {/* 前面（+y） */}
      <div className={face} style={{ ...bf, left: 0, top: d - h, width: w, height: h, background: c.front, transformOrigin: 'bottom', transform: 'rotateX(-90deg)', boxShadow: ring }}>
        {frontPanels.length > 0 && panelLayer(frontPanels, w)}
        {e.kind === 'monitor' && w > d && (
          <div className="absolute inset-[4%] overflow-hidden rounded-sm" style={{ background: a.colors.secondary }}>
            {/* 最初のカットの見出しを、いつも見える状態で出す（opacity で出し入れすると、動きの途中や止まる環境で、薄い字が残る） */}
            <div className="absolute inset-0 flex items-center justify-center px-1 text-center text-[9px] font-black leading-tight text-white">{a.valueProps[0]?.title}</div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
