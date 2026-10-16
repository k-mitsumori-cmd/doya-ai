'use client'

// 全サービスの作業画面で共通に使う部品（オーロラ基調）。
// 見本のため生成APIは呼ばない。処理の進み方はタイマーで再現する。
// 動きは framer-motion と CSS。prefers-reduced-motion では kit.module.css 側で止める。
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ArrowRight, Check, Info, RotateCcw, Sparkles } from 'lucide-react'
import rs from '../renewal.module.css'
import k from './kit.module.css'
import { CountUp, SplitText } from '../motion'
import { STAGES, mascotOf } from '../data'
import { getServiceById } from '@/lib/services'

/* ============================================================
 * 進行の状態（入力 → 実行中 → 結果）
 * ============================================================ */
export type RunStep = { label: string; log: string[] }
export type RunPhase = 'input' | 'run' | 'done'

/** steps を順にこなして done にする。log は1行ずつ流れる */
export function useRun(steps: RunStep[], stepMs = 1300) {
  const [phase, setPhase] = useState<RunPhase>('input')
  const [step, setStep] = useState(0)
  const [lines, setLines] = useState<string[]>([])
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clear, [])

  const start = useCallback(() => {
    clear()
    setPhase('run')
    setStep(0)
    setLines([])
    let at = 0
    steps.forEach((st, i) => {
      timers.current.push(window.setTimeout(() => setStep(i), at))
      st.log.forEach((line, j) => {
        timers.current.push(window.setTimeout(() => setLines((l) => [...l, line]), at + 180 + (j * stepMs) / (st.log.length + 0.5)))
      })
      at += stepMs
    })
    timers.current.push(window.setTimeout(() => setPhase('done'), at + 250))
  }, [steps, stepMs])

  const reset = useCallback(() => {
    clear()
    setPhase('input')
    setStep(0)
    setLines([])
  }, [])

  const pct = phase === 'done' ? 100 : phase === 'input' ? 0 : Math.min(97, Math.round(((step + 0.5) / steps.length) * 100))
  return { phase, step, lines, pct, start, reset }
}

/* ============================================================
 * 画面の枠：オーロラのヒーロー＋工程バー
 * ============================================================ */
export function stageOf(serviceId: string) {
  return STAGES.find((st) => st.serviceIds.includes(serviceId)) ?? STAGES[0]
}

export function ServiceHero({
  serviceId,
  catchCopy,
  points,
  stats,
}: {
  serviceId: string
  /** 大見出し（短く。1〜2行） */
  catchCopy: string
  /** できることを3つまで */
  points: string[]
  /** 右上に浮かべる見本の数字（2つまで） */
  stats?: { label: string; value: number; unit?: string; decimals?: number }[]
}) {
  const svc = getServiceById(serviceId)
  const stage = stageOf(serviceId)
  return (
    <header className={k.hero} style={{ '--c': stage.color } as CSSProperties} data-spot>
      <span className={k.heroMesh} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className={k.heroGrain} aria-hidden="true" />
      <div className={k.heroText}>
        <p className={k.heroCrumb}>
          <span className={k.heroStage}>
            <i />
            {stage.no} {stage.label}
          </span>
          <span className={k.heroName}>{svc?.name}</span>
          <span className={k.heroSample}>
            <Info size={12} strokeWidth={2.4} />
            見本の画面です
          </span>
        </p>
        <h1 className={k.heroTitle}>
          <SplitText text={catchCopy} />
        </h1>
        <ul className={k.heroPoints}>
          {points.slice(0, 3).map((p, i) => (
            <li key={p} style={{ '--i': i } as CSSProperties}>
              <Check size={13} strokeWidth={3} />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={k.heroArt}>
        <span className={k.heroHalo} aria-hidden="true" />
        <img src={mascotOf(serviceId)} alt="" className={k.heroMascot} />
        {stats?.slice(0, 2).map((st, i) => (
          <span key={st.label} className={k.heroStat} data-n={i}>
            <small>{st.label}</small>
            <b>
              <CountUp value={st.value} decimals={st.decimals ?? 0} delay={500 + i * 200} />
              {st.unit && <em>{st.unit}</em>}
            </b>
          </span>
        ))}
      </div>
    </header>
  )
}

/** 工程バー（4つ前後）。current は 0 始まり */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className={k.steps} style={{ '--n': steps.length, '--p': steps.length > 1 ? current / (steps.length - 1) : 1 } as CSSProperties}>
      <span className={k.stepsRail} aria-hidden="true">
        <span />
      </span>
      {steps.map((label, i) => (
        <li key={label} data-state={i < current ? 'done' : i === current ? 'now' : 'wait'}>
          <span className={k.stepsDot}>{i < current ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
          <span className={k.stepsLabel}>{label}</span>
        </li>
      ))}
    </ol>
  )
}

/** 左に入力・右にキャンバスの2カラム。スマホでは縦に積む */
export function Workbench({ form, children, wide }: { form: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`${k.bench} ${wide ? k.benchWide : ''}`}>
      <div className={k.benchForm}>{form}</div>
      <section className={k.benchCanvas} aria-live="polite">
        {children}
      </section>
    </div>
  )
}

/* ============================================================
 * 入力フォームの部品
 * ============================================================ */
export function Panel({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`${k.panel} ${className ?? ''}`} data-spot>
      {title && <p className={k.panelTitle}>{title}</p>}
      {children}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className={k.field}>
      <span className={k.fieldLabel}>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  icon,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  icon?: ReactNode
  placeholder?: string
  ariaLabel?: string
}) {
  return (
    <span className={k.input}>
      {icon}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
    </span>
  )
}

export function TextArea({ value, onChange, rows = 4, ariaLabel }: { value: string; onChange: (v: string) => void; rows?: number; ariaLabel?: string }) {
  return <textarea className={k.textarea} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} />
}

/** 1つ選ぶチップ（選択中の背景が滑って移動する） */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  id,
}: {
  options: readonly T[] | { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  /** 同じ画面に複数置くときの区別（layoutId 用） */
  id: string
}) {
  const list = (options as readonly (T | { id: T; label: string })[]).map((o) => (typeof o === 'string' ? { id: o as T, label: o as string } : o))
  return (
    <div className={k.chips} role="radiogroup">
      {list.map((o) => {
        const on = o.id === value
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={k.chip} onClick={() => onChange(o.id)}>
            {on && <motion.span layoutId={`chip-${id}`} className={k.chipPill} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 複数選ぶチップ */
export function ChipMulti({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className={k.chips}>
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            className={`${k.chip} ${on ? k.chipOn : ''}`}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
          >
            {on && <Check size={12} strokeWidth={3} />}
            <span>{o}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  ariaLabel,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  ariaLabel?: string
}) {
  return (
    <div className={k.slider}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={rs.range}
        style={{ '--v': (value - min) / (max - min) } as CSSProperties}
        aria-label={ariaLabel}
      />
      <div className={k.sliderScale}>
        <span>{format ? format(min) : min}</span>
        <b>{format ? format(value) : value}</b>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={k.toggle} onClick={() => onChange(!on)}>
      <span className={k.toggleTrack}>
        <motion.span layout className={k.toggleKnob} transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
      </span>
      {label}
    </button>
  )
}

/** 実行ボタン。押すと光の波紋が広がる */
export function RunButton({ children, onClick, disabled, icon }: { children: ReactNode; onClick?: () => void; disabled?: boolean; icon?: ReactNode }) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const id = Date.now()
    setRipples((rp) => [...rp, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    window.setTimeout(() => setRipples((rp) => rp.filter((p) => p.id !== id)), 700)
  }
  return (
    <button type="button" className={`${rs.btnPrimary} ${k.runBtn}`} data-magnetic onPointerDown={onDown} onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      <span className={rs.arw}>{icon ?? <Sparkles size={15} strokeWidth={2} />}</span>
      {ripples.map((p) => (
        <i key={p.id} className={k.ripple} style={{ left: p.x, top: p.y }} aria-hidden="true" />
      ))}
    </button>
  )
}

export function GhostButton({ children, onClick, icon }: { children: ReactNode; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button type="button" className={rs.btnGhost} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}

/** 入力前のキャンバス：これから何が起きるかを見せる */
export function IdleCanvas({ serviceId, title, steps }: { serviceId: string; title: string; steps: string[] }) {
  return (
    <div className={k.idle}>
      <span className={k.idleOrbit} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <img src={mascotOf(serviceId)} alt="" className={k.idleImg} />
      <p className={k.idleTitle}>{title}</p>
      <ol className={k.idleSteps}>
        {steps.map((t, i) => (
          <li key={t} style={{ '--i': i } as CSSProperties}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ============================================================
 * 実行中の画面：中央の光る輪＋工程＋流れるログ
 * ============================================================ */
export function RunStage({
  serviceId,
  steps,
  step,
  lines,
  pct,
  skeleton = 'cards',
}: {
  serviceId: string
  steps: RunStep[]
  step: number
  lines: string[]
  pct: number
  /** 下に出す待ちの形 */
  skeleton?: 'cards' | 'rows' | 'doc' | 'none'
}) {
  const logRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines.length])
  return (
    <div className={k.run}>
      <div className={k.runTop}>
        <span className={k.runOrb} style={{ '--p': pct / 100 } as CSSProperties}>
          <span className={k.runOrbRing} />
          <img src={mascotOf(serviceId)} alt="" />
        </span>
        <div className={k.runNow}>
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              className={k.runLabel}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.35 }}
            >
              {steps[step]?.label}…
            </motion.p>
          </AnimatePresence>
          <p className={k.runPct}>
            <b className={rs.num}>{pct}</b>%
          </p>
          <span className={k.runBar}>
            <span style={{ transform: `scaleX(${pct / 100})` }} />
          </span>
        </div>
      </div>
      <ol className={k.runNodes}>
        {steps.map((st, i) => (
          <li key={st.label} data-state={i < step ? 'done' : i === step ? 'now' : 'wait'}>
            <span>{i < step ? <Check size={11} strokeWidth={3} /> : i + 1}</span>
            {st.label}
          </li>
        ))}
      </ol>
      <ul className={k.runLog} ref={logRef}>
        {lines.map((l, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <span className={k.runTime}>{`00:${String(i * 2 + 1).padStart(2, '0')}`}</span>
            {l}
          </motion.li>
        ))}
        <li className={k.runCaret} aria-hidden="true">
          ▍
        </li>
      </ul>
      {skeleton !== 'none' && <Shimmer kind={skeleton} />}
    </div>
  )
}

export function Shimmer({ kind = 'cards' }: { kind?: 'cards' | 'rows' | 'doc' }) {
  if (kind === 'rows')
    return (
      <div className={k.shRows}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
    )
  if (kind === 'doc')
    return (
      <div className={k.shDoc}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} style={{ '--i': i, width: `${94 - (i % 3) * 16}%` } as CSSProperties} />
        ))}
      </div>
    )
  return (
    <div className={k.shCards}>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </div>
  )
}

/* ============================================================
 * 結果の画面で使う部品
 * ============================================================ */
export function ResultHead({ title, note, onRetry, actions }: { title: string; note?: string; onRetry?: () => void; actions?: ReactNode }) {
  return (
    <div className={k.resHead}>
      <Burst />
      <div>
        <p className={k.resTitle}>
          <span className={k.resCheck}>
            <Check size={14} strokeWidth={3} />
          </span>
          {title}
        </p>
        {note && <p className={k.resNote}>{note}</p>}
      </div>
      <div className={k.resActions}>
        {actions}
        {onRetry && (
          <GhostButton onClick={onRetry} icon={<RotateCcw size={14} />}>
            やり直す
          </GhostButton>
        )}
      </div>
    </div>
  )
}

/** 完了時に一瞬だけ散る光の粒 */
export function Burst() {
  return (
    <span className={k.burst} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ '--a': `${(360 / 14) * i}deg`, '--d': `${40 + (i % 3) * 18}px`, '--i': i } as CSSProperties} />
      ))}
    </span>
  )
}

/** 子要素を順に下から出す */
const staggerParent: Variants = { hide: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }
const staggerChild: Variants = {
  hide: { opacity: 0, y: 18, scale: 0.98, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 26 } },
}
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const Comp = motion[as]
  return (
    <Comp className={className} variants={staggerParent} initial="hide" animate="show">
      {Children.map(children, (c) => c)}
    </Comp>
  )
}
export function StaggerItem({ children, className, as = 'div', style }: { children: ReactNode; className?: string; as?: 'div' | 'li'; style?: CSSProperties }) {
  const Comp = motion[as]
  return (
    <Comp className={className} variants={staggerChild} style={style}>
      {children}
    </Comp>
  )
}

/** すりガラスのカード。光がカーソルを追う */
export function Glass({ children, className, style, onClick }: { children: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div className={`${k.glass} ${className ?? ''}`} style={style} data-spot onClick={onClick}>
      {children}
    </div>
  )
}

/** 回る光の縁どり（おすすめ・選択中に） */
export function GlowBorder({ children, className, on = true }: { children: ReactNode; className?: string; on?: boolean }) {
  return <div className={`${k.glow} ${on ? k.glowOn : ''} ${className ?? ''}`}>{children}</div>
}

/** カーソルで傾くカード */
export function TiltCard({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${-y * max}deg`)
    el.style.setProperty('--ry', `${x * max}deg`)
    el.style.setProperty('--gx', `${(x + 0.5) * 100}%`)
    el.style.setProperty('--gy', `${(y + 0.5) * 100}%`)
  }
  const onLeave = () => {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }
  return (
    <div ref={ref} className={`${k.tilt} ${className ?? ''}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
      <span className={k.tiltGlare} aria-hidden="true" />
    </div>
  )
}

/** 文字を1文字ずつ打つ */
export function Typewriter({ text, speed = 28, start = true, onDone }: { text: string; speed?: number; start?: boolean; onDone?: () => void }) {
  const [n, setN] = useState(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    if (!start) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(text.length)
      return
    }
    setN(0)
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id)
          return v
        }
        return v + 1
      })
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed, start])
  // 打ち終わりの通知は描画の外で1回だけ（setState の更新関数の中で親を更新しない）
  const firedRef = useRef('')
  useEffect(() => {
    if (!start || n < text.length || firedRef.current === text) return
    firedRef.current = text
    doneRef.current?.()
  }, [n, text, start])
  return (
    <span className={k.type} aria-label={text}>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      {n < text.length && <i className={k.typeCaret} aria-hidden="true" />}
    </span>
  )
}

/** 横に流れ続ける帯 */
export function Marquee({ items, speed = 40 }: { items: ReactNode[]; speed?: number }) {
  return (
    <div className={k.marquee} style={{ '--dur': `${speed}s` } as CSSProperties}>
      <div className={k.marqueeTrack}>
        {[...items, ...items].map((it, i) => (
          <span key={i} aria-hidden={i >= items.length ? true : undefined}>
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

/** タブ（選択中の下線が滑る） */
export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div className={k.tabs} role="tablist">
      {tabs.map((t) => {
        const on = t.id === value
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} className={k.tab} onClick={() => onChange(t.id)}>
            {t.label}
            {t.count != null && <small>{t.count}</small>}
            {on && <motion.span layoutId={`tab-${id}`} className={k.tabLine} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          </button>
        )
      })}
    </div>
  )
}

/** 数字のタイル */
export function StatTile({
  label,
  value,
  unit,
  decimals = 0,
  delta,
  tone,
}: {
  label: string
  value: number
  unit?: string
  decimals?: number
  /** 前回比など。正なら上向き */
  delta?: string
  tone?: 'up' | 'down'
}) {
  return (
    <Glass className={k.stat}>
      <small>{label}</small>
      <b>
        <CountUp value={value} decimals={decimals} />
        {unit && <em>{unit}</em>}
      </b>
      {delta && <span data-tone={tone ?? 'up'}>{delta}</span>}
    </Glass>
  )
}

/** 線が引かれていく折れ線 */
export function Sparkline({ data, height = 56, color = 'url(#kit-grad)', fill = true }: { data: number[]; height?: number; color?: string; fill?: boolean }) {
  const w = 240
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - 4 - ((v - min) / (max - min || 1)) * (height - 10)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg className={k.spark} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="kit-grad" x1="0" x2="1">
          <stop offset="0" style={{ stopColor: 'var(--k1)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--k2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--k3)' }} />
        </linearGradient>
        <linearGradient id="kit-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--k2)' }} stopOpacity="0.28" />
          <stop offset="1" style={{ stopColor: 'var(--k2)' }} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${w},${height} L0,${height} Z`} fill="url(#kit-fill)" className={k.sparkFill} />}
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={k.sparkLine} />
    </svg>
  )
}

/** 伸びていく棒グラフ */
export function Bars({ data, max, unit }: { data: { label: string; value: number; hi?: boolean }[]; max?: number; unit?: string }) {
  const top = max ?? Math.max(...data.map((d) => d.value))
  return (
    <div className={k.bars}>
      {data.map((d, i) => (
        <div key={d.label} className={k.barCol} data-hi={d.hi ? '' : undefined}>
          <span className={k.barVal}>
            {d.value.toLocaleString('ja-JP')}
            {unit}
          </span>
          <span className={k.barTrack}>
            <span style={{ '--h': d.value / top, '--i': i } as CSSProperties} />
          </span>
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  )
}

/** 横棒（割合） */
export function Meter({ label, value, max = 100, suffix = '', i = 0 }: { label: string; value: number; max?: number; suffix?: string; i?: number }) {
  return (
    <div className={k.meter}>
      <span>{label}</span>
      <span className={k.meterTrack}>
        <span style={{ '--w': value / max, '--i': i } as CSSProperties} />
      </span>
      <b className={rs.num}>
        {value}
        {suffix}
      </b>
    </div>
  )
}

/** 小さなラベル */
export function Badge({ children, tone = 'grad' }: { children: ReactNode; tone?: 'grad' | 'ok' | 'warn' | 'muted' | 'pink' }) {
  return (
    <span className={k.badge} data-tone={tone}>
      {children}
    </span>
  )
}

/** 下から出るシート（書き出し・詳細など） */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={k.sheetScrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={k.sheet}
            role="dialog"
            aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={k.sheetTitle}>{title}</p>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** 画面下に一瞬出る通知 */
export function useFlash() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const id = window.setTimeout(() => setMsg(null), 2200)
    return () => window.clearTimeout(id)
  }, [msg])
  const node = (
    <AnimatePresence>
      {msg && (
        <motion.div
          className={k.flash}
          role="status"
          initial={{ opacity: 0, y: 16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
        >
          <Check size={14} strokeWidth={3} />
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
  return [node, setMsg] as const
}

/** 次の操作へのリンク風ボタン */
export function NextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={k.next} onClick={onClick}>
      {children}
      <ArrowRight size={14} strokeWidth={2.2} />
    </button>
  )
}

export { k as kitStyles }
