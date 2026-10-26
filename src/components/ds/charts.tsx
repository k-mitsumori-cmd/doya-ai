'use client'
// ============================================
// ds/charts — グラフの部品（UI 品質 A-1）
// ============================================
// Sparkline・AreaChart・RadarChart（線が描かれる）、Bars・ColumnChart・GroupedColumnChart・StackedColumnChart・
// StackedBar100・DivergingBars（棒が伸びる）、Ring・Donut（弧が描かれる）。
// - 計算（目盛り・積み上げ・割合・しきい値）は chart-math.ts（テストあり）
// - 高さは先に取る（CLS を増やさない）。動きが止まる環境でも、時間が過ぎたら最後の形を出す（F-12）
// - 色だけで伝えない。凡例・数値の文字・読み上げ用の表を出す
// - 色はトークン（--blue など）。系列が2つ以上のときは、色だけでなく凡例の文字でも区別する
// - 数字やデータは props で受け取るだけ。ここで取得しない
// - 画面に入ったとき1回だけ動く。動きを減らす設定では、最初から最後の形で出す（motion.tsx）
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { DrawIn, useArmed, useDoneAfter, useInViewOnce } from './motion'
import {
  barPercents, formatCompactJa, labelEvery, niceTicks, percentStack, radarPoints, ratioIn, seriesColor, stackExtent, stackValues, thresholdFor,
  SERIES_DASH, SERIES_TONES, TONE_TEXT, type ChartTone, type Threshold,
} from './chart-math'
import styles from './charts.module.css'

export { TONE_COLOR, TONE_TEXT, SERIES_TONES, type ChartTone, type Threshold } from './chart-math'

function scale(values: number[], w: number, h: number, pad = 4) {
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  return values.map((v, i) => [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)] as const)
}

function linePath(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

/** 小さな折れ線（カードの中の推移） */
export function Sparkline({ data, height = 48, label }: { data: number[]; height?: number; label: string }) {
  const w = 160
  const pts = scale(data.length ? data : [0], w, height)
  const gid = useId()
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={styles.svg} role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linePath(pts)} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`} fill={`url(#${gid})`} className={styles.fadeIn} />
      <DrawIn extent={w}>
        <path d={linePath(pts)} fill="none" stroke="var(--blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </DrawIn>
    </svg>
  )
}

/* ------------------------------------------------------------------
 * 共通の小さな部品
 * ------------------------------------------------------------------ */

/** 画面に入ったら伸びる（HTML の棒）。Bars と同じく、隠すのはスクリプトが動いたあとだけ（F-12） */
function useReveal<T extends Element>(ms: number) {
  const { ref, seen } = useInViewOnce<T>()
  const armed = useArmed()
  const done = useDoneAfter(seen, ms)
  return {
    ref,
    attrs: {
      'data-seen': seen ? 'true' : undefined,
      'data-armed': armed && !done ? 'true' : undefined,
      'data-done': done ? 'true' : undefined,
    },
  }
}

/** 要素の幅（px）。最初は initial。幅に合わせて SVG の座標を作り、文字の大きさを保つため */
function useWidth<T extends Element>(initial: number) {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => { const x = Math.round(el.getBoundingClientRect().width); if (x > 0) setW(x) }
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, w }
}

const num = (n: number) => n.toLocaleString('ja-JP')

/** 読み上げ用の表（画面には出さない）。色や形だけで伝えないため、数値を表で渡す */
function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <table className={styles.srOnly}>
      <caption>{caption}</caption>
      <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
        ))}
      </tbody>
    </table>
  )
}

/** 凡例の線の見本（色と線の形の両方で区別する） */
function LegendLine({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden className={styles.legendSvg}>
      <line x1="1" x2="17" y1="3" y2="3" stroke={color} strokeWidth={3} strokeLinecap="round" strokeDasharray={dash} />
    </svg>
  )
}

/** 濃い色の上は白、明るい色の上は濃い文字 */
function inkOn(tone?: ChartTone | string): string {
  return tone === 'yellow' || tone === 'cyan' || tone === 'muted' || tone === 'fair' || tone === 'neutral' ? 'var(--ink, #101633)' : '#fff'
}

/* ------------------------------------------------------------------
 * AreaChart
 * ------------------------------------------------------------------ */

type AreaTone = 'blue' | 'cyan' | ChartTone

/**
 * 面グラフ（1〜6系列）。凡例つき。
 * - 横幅に合わせて座標を作るので、375px でも文字の大きさが変わらない
 * - 負の値を含むときは 0 の線を引き、面は 0 の線まで塗る
 * - yTicks で縦軸の目盛りを出す。domain で範囲を固定できる（例: [0, 100]）
 * - 系列は色と線の形（実線・破線・点線…）の両方で区別する
 * ⚠️ tone: 'cyan' は以前からの意味（濃い青）のまま。水色は 'sky'
 */
export function AreaChart({ labels, series, height = 200, format, yTicks, domain, tickFormat, label, rightTickFormat }: {
  labels: string[]
  /**
   * axis='right' の系列は、右の縦軸（別の目盛り）で測る。桁が大きく違う数（表示とクリックなど）を1つの図に並べるとき、
   * 小さいほうが 0 に張り付かないようにする。凡例には「（右の目盛り）」と出す。format はその系列の数字の書き方
   */
  series: { name: string; values: number[]; tone?: AreaTone; axis?: 'left' | 'right'; format?: (n: number) => string }[]
  height?: number
  format?: (n: number) => string
  /** 縦軸の目盛りを出す。数を渡すと目盛りの数の目安（既定 5） */
  yTicks?: boolean | number
  /** 縦軸の範囲を固定する（例: [0, 100]） */
  domain?: [number, number]
  /** 目盛りの数字の書き方（既定は 1.2万 のような短い形） */
  tickFormat?: (n: number) => string
  /** 読み上げ用の名前（既定は「系列名と系列名の推移」） */
  label?: string
  /** 右の縦軸の目盛りの書き方（既定は tickFormat と同じ） */
  rightTickFormat?: (n: number) => string
}) {
  const { ref, w } = useWidth<HTMLDivElement>(560)
  const gid = useId()
  const isRight = (s: { axis?: 'left' | 'right' }) => s.axis === 'right'
  const hasRight = series.some(isRight)
  const all = series.filter((s) => !isRight(s)).flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const allRight = series.filter(isRight).flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const hasNeg = all.some((v) => v < 0)
  const showTicks = !!yTicks
  const tickCount = typeof yTicks === 'number' ? yTicks : 5
  // 目盛りも負の値も範囲の指定も無いときは、前と同じ形（0〜最大、補助線は 1/4 ごと）
  const legacy = !showTicks && !hasNeg && !domain && !hasRight
  const nt = legacy ? null : niceTicks(Math.min(0, ...all), Math.max(0, ...all), tickCount, domain)
  const lo = nt ? nt.min : 0
  const hi = nt ? nt.max : Math.max(...all, 1)
  const grids = nt ? nt.ticks : [0.25, 0.5, 0.75, 1].map((t) => hi * t)
  const padL = showTicks || hasRight ? 48 : 24, padR = hasRight ? 48 : showTicks ? 16 : 24, padT = 16, padB = 28
  const plotW = Math.max(1, w - padL - padR)
  const step = labels.length > 1 ? plotW / (labels.length - 1) : 0
  const y = (v: number) => padT + (1 - ratioIn(v, lo, hi)) * (height - padT - padB)
  const base = y(Math.max(lo, Math.min(hi, 0)))
  // 右の縦軸（axis='right' の系列だけで範囲を決める。目盛りの数の目安は左と同じ。補助線は左の目盛りに合わせて引く）
  const ntR = hasRight ? niceTicks(Math.min(0, ...allRight), Math.max(0, ...allRight, 1), tickCount) : null
  const yR = (v: number) => (ntR ? padT + (1 - ratioIn(v, ntR.min, ntR.max)) * (height - padT - padB) : y(v))
  const rtfmt = rightTickFormat ?? tickFormat ?? formatCompactJa
  const every = labelEvery(labels.length, plotW, 52)
  const fmt = (n: number) => (format ? format(n) : num(n))
  const tfmt = tickFormat ?? formatCompactJa
  const colorOf = (s: { tone?: AreaTone }, si: number) =>
    s.tone === 'cyan' ? 'var(--blue-deep, #0047d6)' : s.tone ? seriesColor(si, s.tone) : si < 2 ? 'var(--blue, #0066ff)' : seriesColor(si - 1)
  const first = series[0] ? colorOf(series[0], 0) : 'var(--blue)'
  const name = label ?? series.map((s) => s.name).join('と') + 'の推移'
  return (
    <figure className={styles.figure}>
      <div ref={ref} className={styles.areaBox} style={{ height }}>
        <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className={styles.svgFixed} aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={first} stopOpacity="0.32" />
              <stop offset="100%" stopColor={first} stopOpacity="0" />
            </linearGradient>
            {/* 最初の系列の線は、左の水色から右の濃い青へ（インフォグラフィックの見せ方。2026-10-27） */}
            <linearGradient id={`${gid}-line`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--sky, #009bff)" />
              <stop offset="100%" stopColor="var(--blue-deep, #0047d6)" />
            </linearGradient>
          </defs>
          {grids.map((t) => <line key={t} x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className={t === 0 && !legacy ? styles.zero : styles.grid} />)}
          {showTicks || hasRight ? grids.map((t) => <text key={'t' + t} x={padL - 8} y={y(t) + 4} textAnchor="end" className={styles.axis}>{tfmt(t)}</text>) : null}
          {ntR ? ntR.ticks.map((t) => <text key={'r' + t} x={w - padR + 8} y={yR(t) + 4} textAnchor="start" className={styles.axis}>{rtfmt(t)}</text>) : null}
          {series.map((s, si) => {
            const yy = isRight(s) ? yR : y
            const pts = s.values.map((v, i) => [padL + i * step, yy(Number.isFinite(v) ? v : 0)] as const)
            if (!pts.length) return null
            const stroke = colorOf(s, si)
            const lineStroke = si === 0 && !s.tone && pts.length > 1 ? `url(#${gid}-line)` : stroke
            const dash = SERIES_DASH[si % SERIES_DASH.length]
            const [lx, ly] = pts[pts.length - 1]
            return (
              <g key={s.name}>
                {si === 0 ? <path d={`${linePath(pts)} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`} fill={`url(#${gid})`} className={styles.fadeIn} /> : null}
                <DrawIn duration={1000 + si * 200} extent={w}>
                  <path d={linePath(pts)} fill="none" stroke={lineStroke} strokeWidth={si === 0 ? 3 : 2.5} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" />
                </DrawIn>
                {/* いちばん新しい点に、広がる輪を2回だけ出す（目が最新の値に行くように） */}
                {si === 0 ? <circle cx={lx} cy={ly} r={4} className={styles.pulse} style={{ stroke }} aria-hidden /> : null}
                {pts.map(([px, py], i) => (
                  <circle key={i} cx={px} cy={py} r={i === pts.length - 1 ? 4.5 : 3.5} className={styles.point} style={{ stroke }}>
                    <title>{`${labels[i]} ${s.name} ${(s.format ?? fmt)(s.values[i])}`}</title>
                  </circle>
                ))}
              </g>
            )
          })}
          {labels.map((l, i) => {
            const last = labels.length - 1
            // 間引くときも最後の文字は出す（その直前に出す文字との間が、間引きの間隔より狭いときは、そちらを省く）
            const show = i === last || (i % every === 0 && !(last % every !== 0 && last - i < every))
            if (!show) return null
            const anchor = labels.length > 1 && i === 0 ? 'start' : labels.length > 1 && i === last ? 'end' : 'middle'
            return <text key={l + i} x={padL + i * step} y={height - 8} textAnchor={anchor} className={styles.axis}>{l}</text>
          })}
        </svg>
      </div>
      <figcaption className={styles.legend}>
        {series.map((s, si) => (
          <span key={s.name}><LegendLine color={colorOf(s, si)} dash={SERIES_DASH[si % SERIES_DASH.length]} />{s.name}{hasRight ? (isRight(s) ? '（右の目盛り）' : '（左の目盛り）') : ''}</span>
        ))}
      </figcaption>
      <SrTable caption={name} head={['', ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => (s.format ?? fmt)(s.values[i]))])} />
    </figure>
  )
}

/* ------------------------------------------------------------------
 * Bars（横棒）
 * ------------------------------------------------------------------ */

/**
 * 横棒（段階ごとの金額など）。画面に入ったら左から伸びる。
 * - basis='total' で、合計に占める割合で描き、割合（%）も出す（既定は一番大きい値が 100%）
 * - highlight で1行だけ強調する（自社など）。強調があると、ほかの行は灰色になる。文字の印も出す
 * - tone で1本ずつ色を変えられる
 */
export function Bars({ data, format, basis = 'max' }: {
  data: { label: string; value: number; sub?: string; highlight?: boolean | string; tone?: ChartTone | string }[]
  format?: (n: number) => string
  /** 'max' は一番大きい値を基準、'total' は合計を基準（全体に占める割合） */
  basis?: 'max' | 'total'
}) {
  const { ref, seen } = useInViewOnce<HTMLUListElement>()
  const armed = useArmed()
  const done = useDoneAfter(seen, 700 + data.length * 70 + 400)
  const widths = barPercents(data.map((d) => d.value), basis)
  const shares = basis === 'total' ? percentStack(data.map((d) => d.value)).labels : null
  const anyHi = data.some((d) => d.highlight)
  return (
    <ul ref={ref} className={styles.bars} data-seen={seen ? 'true' : undefined} data-armed={armed && !done ? 'true' : undefined} data-done={done ? 'true' : undefined}>
      {data.map((d, i) => {
        const fill = d.tone ? seriesColor(i, d.tone) : anyHi && !d.highlight ? 'var(--line-strong, #c6cde0)' : undefined
        return (
          <li key={`${i}-${d.label}`} data-highlight={d.highlight ? 'true' : undefined}>
            <div className={styles.barHead}>
              <span className={styles.barLabel}>
                {d.label}
                {d.highlight ? <em className={styles.hiMark}>{typeof d.highlight === 'string' ? d.highlight : '注目'}</em> : null}
              </span>
              <span className={styles.barValue}>
                {d.sub ? `${d.sub} ・ ` : ''}{format ? format(d.value) : d.value.toLocaleString('ja-JP')}{shares ? ` ・ ${shares[i]}%` : ''}
              </span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ '--w': `${Math.max(2, widths[i])}%`, '--i': i, ...(fill ? { backgroundColor: fill, backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${fill} 55%, white), ${fill})` } : {}) } as CSSProperties} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------
 * Ring・Donut
 * ------------------------------------------------------------------ */

/**
 * 円の進み具合（0〜1）。中央に文字を置ける。
 * - tone で意味のある色（good / fair / poor など）を選べる。thresholds で値に応じて色を変える
 * - 色の意味は文字でも出す（toneLabel か、しきい値の label。good などは既定の文字）
 * - 読み上げは「名前：〇%（意味）」の1回だけ。中央の文字と円は読み上げない
 */
export function Ring({ value, size = 96, label, children, tone, thresholds, toneLabel, showToneLabel = true }: {
  value: number
  size?: number
  label: string
  children?: React.ReactNode
  /** 色（トークンの名前か CSS の色） */
  tone?: ChartTone | string
  /** 値（0〜1）に応じた色。例: [{at:0,tone:'poor',label:'要改善'},{at:0.5,tone:'fair'},{at:0.8,tone:'good'}] */
  thresholds?: Threshold[]
  /** 色の意味の文字（例: 良い） */
  toneLabel?: string
  /** 色の意味の文字を円の下に出す（既定 true。意味のある色のときだけ出る） */
  showToneLabel?: boolean
}) {
  const r = 40
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const th = thresholds ? thresholdFor(v, thresholds) : undefined
  const t = tone ?? th?.tone
  const meaning = toneLabel ?? th?.label ?? (t ? TONE_TEXT[t as ChartTone] : undefined)
  const stroke = t ? seriesColor(0, t) : undefined
  const pct = Math.round(v * 100)
  // 色の指定が無いときは、青から水色へのグラデーションで描く（インフォグラフィックの見せ方。2026-10-27）
  const gid = `ds-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const ring = (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden>
        {stroke ? null : (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--sky, #009bff)" />
              <stop offset="100%" stopColor="var(--blue-deep, #0047d6)" />
            </linearGradient>
          </defs>
        )}
        <circle cx="50" cy="50" r={r} className={styles.ringTrack} />
        <DrawIn mode="stroke">
          <circle cx="50" cy="50" r={r} pathLength={1} className={styles.ringValue} style={{ strokeDasharray: `${v} 1`, stroke: stroke ?? `url(#${gid})` } as CSSProperties} transform="rotate(-90 50 50)" />
        </DrawIn>
      </svg>
      {children ? <div className={styles.ringCenter} aria-hidden>{children}</div> : null}
      <span className={styles.srOnly}>{`${label}：${pct}%${meaning ? `（${meaning}）` : ''}`}</span>
    </div>
  )
  if (!(meaning && showToneLabel)) return ring
  return (
    <div className={styles.ringWrap} style={{ width: Math.max(size, 72) }}>
      {ring}
      <span className={styles.ringTone} aria-hidden><i className={styles.swatch} style={{ background: stroke }} />{meaning}</span>
    </div>
  )
}

const DONUT_BLUE = ['var(--blue)', 'var(--blue-deep)', 'var(--navy)', 'var(--blue-line)', 'var(--line-strong)']

/**
 * 割合の円。区分は凡例の文字（名前と %）でも区別する。
 * - 6区分以上は、ブランドの青とアクセントの色を順に使う（palette='brand' でいつでも）
 * - colors で色の配列を、data[].tone で区分ごとの色を渡せる（positive / neutral / negative など）
 * - center で中央に文字（合計など）を置ける
 * - 合計が 0 のときは、空の輪ではなく「データがありません」を出す
 */
export function Donut({ data, size = 120, label, center, colors, palette, empty = 'データがありません' }: {
  data: { label: string; value: number; tone?: ChartTone | string }[]
  size?: number
  label: string
  /** 中央の文字（合計など） */
  center?: React.ReactNode
  /** 色の配列（トークンの名前か CSS の色）。足りない分は palette の色 */
  colors?: (ChartTone | string)[]
  /** 'blue' は青の濃淡（5区分まで）、'brand' は青とアクセント（既定は6区分以上で 'brand'） */
  palette?: 'blue' | 'brand'
  /** 合計が 0 のときの文字 */
  empty?: React.ReactNode
}) {
  const { percents, labels: pctLabels, total } = percentStack(data.map((d) => d.value))
  const maskId = `ds-donut-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const usePalette = palette ?? (data.length > DONUT_BLUE.length ? 'brand' : 'blue')
  const colorOf = (i: number) => {
    const t = data[i]?.tone ?? colors?.[i]
    if (t) return seriesColor(i, t)
    return usePalette === 'brand' ? seriesColor(i) : DONUT_BLUE[i % DONUT_BLUE.length]
  }
  if (total <= 0) {
    return (
      <figure className={styles.donut}>
        <div className={styles.donutChart} style={{ width: size, height: size }}>
          <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
            <circle cx="50" cy="50" r="38" className={styles.ringTrack} style={{ strokeWidth: 14 }} />
          </svg>
          <div className={styles.donutCenter}><span className={styles.donutEmpty}>{empty}</span></div>
        </div>
        <span className={styles.srOnly}>{label}</span>
      </figure>
    )
  }
  let acc = 0
  return (
    <figure className={styles.donut}>
      <div className={styles.donutChart} style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} className={styles.donutSpin}>
          <defs>
            {/* 区分ごとに開始位置（dashoffset）を持つので、区分ではなく「見える範囲」を円に沿って描き出す（回って出る。2026-10-27） */}
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <DrawIn mode="stroke" duration={1100}>
                <circle cx="50" cy="50" r="38" pathLength={1} fill="none" stroke="#fff" strokeWidth={18} transform="rotate(-90 50 50)" />
              </DrawIn>
            </mask>
          </defs>
          <circle cx="50" cy="50" r="38" className={styles.ringTrack} />
          <g mask={`url(#${maskId})`}>
            {data.map((d, i) => {
              const part = percents[i] / 100
              const el = <circle key={d.label} cx="50" cy="50" r="38" pathLength={1} fill="none" stroke={colorOf(i)} strokeWidth={14} style={{ strokeDasharray: `${part} 1`, strokeDashoffset: -acc } as CSSProperties} transform="rotate(-90 50 50)" />
              acc += part
              return el
            })}
            {/* 区分の境目に細い白い線を入れて、色の切り替わりをはっきりさせる */}
            {percents.length > 1 ? (() => {
              let at = 0
              return percents.map((p, i) => {
                const a = (at * 360 - 90) * (Math.PI / 180)
                at += p / 100
                return p > 0 ? <line key={'sep' + i} x1={50 + 31 * Math.cos(a)} y1={50 + 31 * Math.sin(a)} x2={50 + 45 * Math.cos(a)} y2={50 + 45 * Math.sin(a)} stroke="var(--paper, #fff)" strokeWidth={1.2} /> : null
              })
            })() : null}
          </g>
        </svg>
        {center ? <div className={styles.donutCenter}>{center}</div> : null}
      </div>
      <figcaption className={styles.legend}>
        {data.map((d, i) => (
          <span key={d.label}><i className={styles.swatch} style={{ background: colorOf(i) }} />{d.label} {pctLabels[i]}%</span>
        ))}
      </figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------------
 * 縦棒（ColumnChart・GroupedColumnChart・StackedColumnChart）
 * ------------------------------------------------------------------ */

type Seg = { from: number; to: number; color: string; title: string }
type Slot = { segs: Seg[]; valueLabel?: string; top: number; bottom: number }

/** 縦棒の共通の描き方。HTML で描くので、375px でも文字の大きさが変わらない */
function ColumnPlot({ groups, labels, lo, hi, ticks, height, tickFormat, label, legend, table, showValues }: {
  groups: Slot[][]
  labels: string[]
  lo: number
  hi: number
  ticks: number[] | null
  height: number
  tickFormat: (n: number) => string
  label: string
  legend?: { name: string; color: string }[]
  table: { head: string[]; rows: string[][] }
  showValues: boolean
}) {
  const n = groups.length
  const { ref, attrs } = useReveal<HTMLDivElement>(700 + n * 50 + 400)
  const hasNeg = lo < 0
  const pct = (v: number) => ratioIn(v, lo, hi) * 100
  const zero = pct(Math.max(lo, Math.min(hi, 0)))
  const topPad = showValues ? 20 : 8
  const botPad = showValues && hasNeg ? 18 : 0
  const yw = ticks ? 44 : 0
  return (
    <figure className={styles.figure} aria-label={label}>
      <div ref={ref} {...attrs} className={styles.colPlot} style={{ height }} aria-hidden data-dense={n > 8 ? 'true' : undefined}>
        <div className={styles.colInner} style={{ top: topPad, bottom: botPad, left: yw }}>
          {(ticks ?? []).map((t) => (
            <div key={t} className={t === 0 ? styles.colZero : styles.colGrid} style={{ bottom: `${pct(t)}%` }}>
              <span className={styles.colTick} style={{ width: yw }}>{tickFormat(t)}</span>
            </div>
          ))}
          {!ticks || !ticks.includes(0) ? <div className={styles.colZero} style={{ bottom: `${zero}%` }} /> : null}
          <div className={styles.colGroups} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {groups.map((slots, gi) => (
              <div key={gi} className={styles.colGroup}>
                {slots.map((s, si) => (
                  <div key={si} className={styles.colSlot}>
                    <div className={styles.colGrow} style={{ '--i': gi, transformOrigin: `center ${100 - zero}%` } as CSSProperties}>
                      {s.segs.map((g, k) => {
                        const a = pct(Math.min(g.from, g.to)), b = pct(Math.max(g.from, g.to))
                        // 上を明るくしたグラデーション（color-mix に対応しないブラウザでは、単色の backgroundColor が残る）
                        return <div key={k} className={styles.colSeg} title={g.title} style={{ bottom: `${a}%`, height: `${Math.max(b - a, g.to === g.from ? 0 : 0.6)}%`, backgroundColor: g.color, backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${g.color} 55%, white), ${g.color} 85%)` }} />
                      })}
                    </div>
                    {showValues && s.valueLabel ? (
                      s.top > 0 || s.bottom >= 0
                        ? <span className={styles.colValue} style={{ bottom: `calc(${pct(s.top)}% + 2px)`, '--i': gi } as CSSProperties}>{s.valueLabel}</span>
                        : <span className={styles.colValue} style={{ top: `calc(${100 - pct(s.bottom)}% + 2px)`, '--i': gi } as CSSProperties}>{s.valueLabel}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.colLabels} style={{ marginLeft: yw, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden data-dense={n > 8 ? 'true' : undefined}>
        {labels.map((l, i) => <span key={i} title={l}>{l}</span>)}
      </div>
      {legend && legend.length > 1 ? (
        <figcaption className={styles.legend}>
          {legend.map((s) => <span key={s.name}><i className={styles.swatch} style={{ background: s.color }} />{s.name}</span>)}
        </figcaption>
      ) : null}
      <SrTable caption={label} head={table.head} rows={table.rows} />
    </figure>
  )
}

/**
 * 縦棒（1系列）。画面に入ったら 0 の線から伸びる。負の値は下へ伸びる。
 * highlight で1本だけ強調（自社など。ほかは灰色）、tone で1本ずつ色を変えられる
 */
export function ColumnChart({ data, label, height = 200, format, yTicks = true, domain, tickFormat, showValues = true }: {
  data: { label: string; value: number; highlight?: boolean; tone?: ChartTone | string }[]
  label: string
  height?: number
  format?: (n: number) => string
  yTicks?: boolean | number
  domain?: [number, number]
  tickFormat?: (n: number) => string
  /** 棒の上に値を出す（既定 true。9本以上のときは狭い画面で隠し、読み上げ用の表に任せる） */
  showValues?: boolean
}) {
  const vals = data.map((d) => (Number.isFinite(d.value) ? d.value : 0))
  const nt = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), typeof yTicks === 'number' ? yTicks : 5, domain)
  const fmt = format ?? num
  const anyHi = data.some((d) => d.highlight)
  const groups: Slot[][] = data.map((d, i) => {
    const v = vals[i]
    const color = d.tone ? seriesColor(i, d.tone) : anyHi && !d.highlight ? 'var(--line-strong, #c6cde0)' : 'var(--blue, #0066ff)'
    return [{ segs: [{ from: 0, to: v, color, title: `${d.label} ${fmt(v)}` }], valueLabel: fmt(v), top: Math.max(0, v), bottom: Math.min(0, v) }]
  })
  return (
    <ColumnPlot groups={groups} labels={data.map((d) => d.label)} lo={nt.min} hi={nt.max} ticks={yTicks ? nt.ticks : null} height={height}
      tickFormat={tickFormat ?? formatCompactJa} label={label} showValues={showValues}
      table={{ head: ['', '値'], rows: data.map((d, i) => [d.label + (d.highlight ? '（強調）' : ''), fmt(vals[i])]) }} />
  )
}

/** 複数系列の縦棒（グループ）。系列は凡例の文字でも区別する */
export function GroupedColumnChart({ labels, series, label, height = 220, format, yTicks = true, domain, tickFormat, showValues = false }: {
  labels: string[]
  series: { name: string; values: number[]; tone?: ChartTone | string }[]
  label: string
  height?: number
  format?: (n: number) => string
  yTicks?: boolean | number
  domain?: [number, number]
  tickFormat?: (n: number) => string
  showValues?: boolean
}) {
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const nt = niceTicks(Math.min(0, ...all), Math.max(0, ...all), typeof yTicks === 'number' ? yTicks : 5, domain)
  const fmt = format ?? num
  const colors = series.map((s, si) => seriesColor(si, s.tone))
  const groups: Slot[][] = labels.map((l, i) => series.map((s, si) => {
    const v = Number.isFinite(s.values[i]) ? s.values[i] : 0
    return { segs: [{ from: 0, to: v, color: colors[si], title: `${l} ${s.name} ${fmt(v)}` }], valueLabel: fmt(v), top: Math.max(0, v), bottom: Math.min(0, v) }
  }))
  return (
    <ColumnPlot groups={groups} labels={labels} lo={nt.min} hi={nt.max} ticks={yTicks ? nt.ticks : null} height={height}
      tickFormat={tickFormat ?? formatCompactJa} label={label} showValues={showValues}
      legend={series.map((s, si) => ({ name: s.name, color: colors[si] }))}
      table={{ head: ['', ...series.map((s) => s.name)], rows: labels.map((l, i) => [l, ...series.map((s) => fmt(s.values[i] ?? 0))]) }} />
  )
}

/** 縦の積み上げ棒。棒の上に合計を出す。負の値は 0 の線から下へ積む */
export function StackedColumnChart({ labels, series, label, height = 220, format, yTicks = true, domain, tickFormat, showTotals = true }: {
  labels: string[]
  series: { name: string; values: number[]; tone?: ChartTone | string }[]
  label: string
  height?: number
  format?: (n: number) => string
  yTicks?: boolean | number
  domain?: [number, number]
  tickFormat?: (n: number) => string
  /** 棒の上に合計を出す */
  showTotals?: boolean
}) {
  const vals = series.map((s) => labels.map((_, i) => (Number.isFinite(s.values[i]) ? s.values[i] : 0)))
  const st = stackValues(vals)
  const [elo, ehi] = stackExtent(vals)
  const nt = niceTicks(elo, ehi, typeof yTicks === 'number' ? yTicks : 5, domain)
  const fmt = format ?? num
  const colors = series.map((s, si) => seriesColor(si, s.tone))
  const groups: Slot[][] = labels.map((l, i) => {
    const total = vals.reduce((a, s) => a + s[i], 0)
    const top = Math.max(0, ...st.map((s) => s[i][1]))
    const bottom = Math.min(0, ...st.map((s) => s[i][0]))
    return [{
      segs: series.map((s, si) => ({ from: st[si][i][0], to: st[si][i][1], color: colors[si], title: `${l} ${s.name} ${fmt(vals[si][i])}` })),
      valueLabel: fmt(total), top, bottom,
    }]
  })
  return (
    <ColumnPlot groups={groups} labels={labels} lo={nt.min} hi={nt.max} ticks={yTicks ? nt.ticks : null} height={height}
      tickFormat={tickFormat ?? formatCompactJa} label={label} showValues={showTotals}
      legend={series.map((s, si) => ({ name: s.name, color: colors[si] }))}
      table={{ head: ['', ...series.map((s) => s.name), '合計'], rows: labels.map((l, i) => [l, ...vals.map((s) => fmt(s[i])), fmt(vals.reduce((a, s) => a + s[i], 0))]) }} />
  )
}

/* ------------------------------------------------------------------
 * 100% の横の積み上げ（StackedBar100）
 * ------------------------------------------------------------------ */

/**
 * 100% の横の積み上げ棒（構成比）。区分の割合を棒の中に % で出し（狭い区分は省く）、凡例も出す。
 * 割合の数字は、行ごとに合計が必ず 100 になるよう丸める
 */
export function StackedBar100({ rows, categories, label, format, showTotal = true }: {
  rows: { label: string; values: number[] }[]
  categories: { name: string; tone?: ChartTone | string }[]
  label: string
  format?: (n: number) => string
  /** 行の右に合計を出す */
  showTotal?: boolean
}) {
  const { ref, attrs } = useReveal<HTMLUListElement>(700 + rows.length * 70 + 400)
  const colors = categories.map((c, ci) => seriesColor(ci, c.tone))
  const fmt = format ?? num
  const stacks = rows.map((r) => percentStack(categories.map((_, ci) => r.values[ci] ?? 0)))
  return (
    <figure className={styles.figure} aria-label={label}>
      <ul ref={ref} {...attrs} className={styles.bars} aria-hidden>
        {rows.map((r, ri) => {
          const p = stacks[ri]
          return (
            <li key={`${ri}-${r.label}`}>
              <div className={styles.barHead}>
                <span className={styles.barLabel}>{r.label}</span>
                {showTotal ? <span className={styles.barValue}>{fmt(p.total)}</span> : null}
              </div>
              <div className={styles.stackTrack} style={{ '--i': ri } as CSSProperties}>
                {p.total <= 0 ? <span className={styles.stackEmpty}>データがありません</span> : categories.map((c, ci) => p.percents[ci] > 0 ? (
                  <span key={c.name} className={styles.stackSeg} title={`${c.name} ${p.labels[ci]}%`} style={{ width: `${p.percents[ci]}%`, background: colors[ci], color: inkOn(c.tone ?? SERIES_TONES[ci % SERIES_TONES.length]) }}>
                    {p.percents[ci] >= 12 ? `${p.labels[ci]}%` : ''}
                  </span>
                ) : null)}
              </div>
            </li>
          )
        })}
      </ul>
      <figcaption className={styles.legend}>
        {categories.map((c, ci) => <span key={c.name}><i className={styles.swatch} style={{ background: colors[ci] }} />{c.name}</span>)}
      </figcaption>
      <SrTable caption={label} head={['', ...categories.map((c) => c.name)]} rows={rows.map((r, ri) => [r.label, ...categories.map((_, ci) => `${fmt(r.values[ci] ?? 0)}（${stacks[ri].labels[ci]}%）`)])} />
    </figure>
  )
}

/* ------------------------------------------------------------------
 * 0 を挟んで左右に伸びる棒（DivergingBars）
 * ------------------------------------------------------------------ */

/**
 * 0 を挟んで左右に伸びる棒（増減・前月比・好き嫌いなど）。
 * 正は右へ（既定 青）、負は左へ（既定 ピンク）。値には +／− の記号を付け、色だけで伝えない
 */
export function DivergingBars({ data, label, format, negativeLabel, positiveLabel, positiveTone = 'blue', negativeTone = 'pink' }: {
  data: { label: string; value: number; highlight?: boolean | string }[]
  label: string
  format?: (n: number) => string
  /** 左側の見出し（例: 減少） */
  negativeLabel?: string
  /** 右側の見出し（例: 増加） */
  positiveLabel?: string
  positiveTone?: ChartTone | string
  negativeTone?: ChartTone | string
}) {
  const { ref, attrs } = useReveal<HTMLUListElement>(700 + data.length * 70 + 400)
  const maxAbs = Math.max(0, ...data.map((d) => (Number.isFinite(d.value) ? Math.abs(d.value) : 0))) || 1
  const fmt = (n: number) => {
    const body = format ? format(Math.abs(n)) : num(Math.abs(n))
    return n > 0 ? `+${body}` : n < 0 ? `−${body}` : body
  }
  const pos = seriesColor(0, positiveTone), neg = seriesColor(0, negativeTone)
  return (
    <figure className={styles.figure} aria-label={label}>
      {negativeLabel || positiveLabel ? (
        <div className={styles.divHead} aria-hidden><span>{negativeLabel ? `← ${negativeLabel}` : ''}</span><span>{positiveLabel ? `${positiveLabel} →` : ''}</span></div>
      ) : null}
      <ul ref={ref} {...attrs} className={styles.bars} aria-hidden>
        {data.map((d, i) => {
          const v = Number.isFinite(d.value) ? d.value : 0
          const w = `${Math.max(v === 0 ? 0 : 1.5, (Math.abs(v) / maxAbs) * 100)}%`
          return (
            <li key={`${i}-${d.label}`} data-highlight={d.highlight ? 'true' : undefined}>
              <div className={styles.barHead}>
                <span className={styles.barLabel}>{d.label}{d.highlight ? <em className={styles.hiMark}>{typeof d.highlight === 'string' ? d.highlight : '注目'}</em> : null}</span>
                <span className={styles.barValue}>{fmt(v)}</span>
              </div>
              <div className={styles.divTrack}>
                <div className={styles.divHalf} data-side="neg">
                  {v < 0 ? <div className={styles.divFill} data-side="neg" style={{ width: w, background: neg, '--i': i } as CSSProperties} /> : null}
                </div>
                <div className={styles.divHalf} data-side="pos">
                  {v > 0 ? <div className={styles.divFill} data-side="pos" style={{ width: w, background: pos, '--i': i } as CSSProperties} /> : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <SrTable caption={label} head={['', '値']} rows={data.map((d) => [d.label, fmt(Number.isFinite(d.value) ? d.value : 0)])} />
    </figure>
  )
}

/* ------------------------------------------------------------------
 * レーダー（RadarChart）
 * ------------------------------------------------------------------ */

/**
 * レーダー（5〜8項目の評価など）。線は DrawIn で描かれ、面は最初から見える。
 * 系列は色と線の形の両方で区別し、凡例を出す。軸の名前の横に、最初の系列の値を出す
 */
export function RadarChart({ axes, series, label, max, size = 320, format, rings = 4 }: {
  axes: string[]
  series: { name: string; values: number[]; tone?: ChartTone | string }[]
  label: string
  /** 外周の値（既定は全系列の最大値をきりよく丸めたもの） */
  max?: number
  /** 表示の最大幅（px） */
  size?: number
  format?: (n: number) => string
  /** 補助の輪の数 */
  rings?: number
}) {
  const W = 360, H = 300, cx = W / 2, cy = H / 2 + 4, R = 100
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const top = max ?? niceTicks(0, Math.max(1, ...all), 5).max
  const fmt = format ?? num
  const n = axes.length
  const colors = series.map((s, si) => seriesColor(si, s.tone))
  const outer = radarPoints(axes.map(() => top), top, R, cx, cy)
  const lab = radarPoints(axes.map(() => top), top, R + 16, cx, cy)
  const poly = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ') + ' Z'
  return (
    <figure className={styles.figure} aria-label={label} style={{ maxWidth: size, marginInline: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-hidden>
        {Array.from({ length: rings }, (_, k) => {
          const rr = ((k + 1) / rings) * R
          return <path key={k} d={poly(radarPoints(axes.map(() => top), top, rr, cx, cy))} className={styles.radarGrid} />
        })}
        {outer.map(([x, y], i) => <line key={i} x1={cx} y1={cy} x2={x} y2={y} className={styles.grid} />)}
        {series.map((s, si) => {
          const pts = radarPoints(axes.map((_, i) => s.values[i] ?? 0), top, R, cx, cy)
          return (
            <g key={s.name}>
              <path d={poly(pts)} fill={colors[si]} fillOpacity={si === 0 ? 0.16 : 0.08} className={styles.fadeIn} />
              <DrawIn duration={1000 + si * 200} extent={W}>
                <path d={poly(pts)} fill="none" stroke={colors[si]} strokeWidth={2.5} strokeDasharray={SERIES_DASH[si % SERIES_DASH.length]} strokeLinejoin="round" />
              </DrawIn>
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3} className={styles.point} style={{ stroke: colors[si] }}>
                  <title>{`${axes[i]} ${s.name} ${fmt(s.values[i] ?? 0)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        {lab.map(([x, y], i) => {
          const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end'
          const dy = y < cy - R * 0.5 ? -2 : y > cy + R * 0.5 ? 12 : 4
          return (
            <text key={i} x={x} y={y + dy} textAnchor={anchor} className={styles.radarLabel}>
              {axes[i]}
              {series[0] ? <tspan className={styles.radarValue}>{` ${fmt(series[0].values[i] ?? 0)}`}</tspan> : null}
            </text>
          )
        })}
      </svg>
      {series.length > 1 ? (
        <figcaption className={styles.legend} style={{ justifyContent: 'center' }}>
          {series.map((s, si) => <span key={s.name}><LegendLine color={colors[si]} dash={SERIES_DASH[si % SERIES_DASH.length]} />{s.name}</span>)}
        </figcaption>
      ) : null}
      <SrTable caption={label} head={['', ...series.map((s) => s.name)]} rows={axes.map((a, i) => [a, ...series.map((s) => fmt(s.values[i] ?? 0))])} />
      {n < 3 ? <span className={styles.srOnly}>項目が3つ未満のため、形は参考です</span> : null}
    </figure>
  )
}

/* ------------------------------------------------------------------
 * 表の中の小さな積み上げ（MiniStack）
 * ------------------------------------------------------------------ */

/**
 * 表のセルに置く、小さな横の積み上げ棒（通常と残業など）。凡例は持たないので、
 * 値は隣の列か label の文字で必ず伝える（色だけで伝えない）。読み上げは label の1回だけ。
 * - basis で棒の全長に当たる値を決める（既定は合計。例: 8時間を全長にするなら 480）
 * - 高さと幅は固定（CLS を増やさない）
 */
export function MiniStack({ parts, label, basis, width = 56, height = 8 }: {
  parts: { value: number; tone?: ChartTone | string; name?: string }[]
  /** 読み上げの文字（例: 勤務 8時間30分（うち残業 30分）） */
  label: string
  basis?: number
  width?: number | string
  height?: number
}) {
  const vals = parts.map((p) => (Number.isFinite(p.value) && p.value > 0 ? p.value : 0))
  const total = vals.reduce((a, v) => a + v, 0)
  const full = Math.max(basis ?? 0, total) || 1
  return (
    <span role="img" aria-label={label} title={label}
      style={{ display: 'inline-flex', width, height, borderRadius: 999, overflow: 'hidden', background: 'var(--line, #e3e8f2)', flex: 'none', verticalAlign: 'middle' }}>
      {parts.map((p, i) => vals[i] > 0 ? (
        <span key={i} style={{ width: `${(vals[i] / full) * 100}%`, height: '100%', background: seriesColor(i, p.tone) }} />
      ) : null)}
    </span>
  )
}
