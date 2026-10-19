'use client'
// ============================================
// ds/charts — グラフの部品（UI 品質 A-1）
// ============================================
// Sparkline・AreaChart（線が描かれる）、Bars（棒が伸びる）、Ring・Donut（弧が描かれる）。
// - 色はトークン（--blue など）。系列が2つ以上のときは、色だけでなく凡例の文字でも区別する
// - 数字やデータは props で受け取るだけ。ここで取得しない
// - 画面に入ったとき1回だけ動く。動きを減らす設定では、最初から最後の形で出す（motion.tsx）
import { useId, type CSSProperties } from 'react'
import { DrawIn, useInViewOnce } from './motion'
import styles from './charts.module.css'

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
      <DrawIn>
        <path d={linePath(pts)} pathLength={1} fill="none" stroke="var(--blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </DrawIn>
    </svg>
  )
}

/** 面グラフ（1〜2系列）。凡例つき */
export function AreaChart({ labels, series, height = 200, format }: {
  labels: string[]
  series: { name: string; values: number[]; tone?: 'blue' | 'cyan' }[]
  height?: number
  format?: (n: number) => string
}) {
  const w = 560, pad = 24
  const all = series.flatMap((s) => s.values)
  const max = Math.max(...all, 1)
  const step = labels.length > 1 ? (w - pad * 2) / (labels.length - 1) : 0
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2)
  const gid = useId()
  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${w} ${height}`} className={styles.svg} role="img" aria-label={series.map((s) => s.name).join('と') + 'の推移'}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={pad} x2={w - pad} y1={y(max * t)} y2={y(max * t)} className={styles.grid} />)}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [pad + i * step, y(v)] as const)
          const stroke = s.tone === 'cyan' ? 'var(--blue-deep)' : 'var(--blue)'
          return (
            <g key={s.name}>
              {si === 0 ? <path d={`${linePath(pts)} L${pts[pts.length - 1][0]},${height - pad} L${pts[0][0]},${height - pad} Z`} fill={`url(#${gid})`} className={styles.fadeIn} /> : null}
              <DrawIn duration={1000 + si * 200}>
                <path d={linePath(pts)} pathLength={1} fill="none" stroke={stroke} strokeWidth={2.5} strokeDasharray={si === 1 ? '6 4' : undefined} strokeLinecap="round" strokeLinejoin="round" />
              </DrawIn>
              {pts.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={3.5} className={styles.point} style={{ stroke }}>
                  <title>{`${labels[i]} ${s.name} ${format ? format(s.values[i]) : s.values[i]}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        {labels.map((l, i) => <text key={l + i} x={pad + i * step} y={height - 6} textAnchor="middle" className={styles.axis}>{l}</text>)}
      </svg>
      <figcaption className={styles.legend}>
        {series.map((s, si) => (
          <span key={s.name}><i className={si === 1 ? styles.legendDash : styles.legendLine} />{s.name}</span>
        ))}
      </figcaption>
    </figure>
  )
}

/** 横棒（段階ごとの金額など）。画面に入ったら左から伸びる */
export function Bars({ data, format }: { data: { label: string; value: number; sub?: string }[]; format?: (n: number) => string }) {
  const { ref, seen } = useInViewOnce<HTMLUListElement>()
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <ul ref={ref} className={styles.bars} data-seen={seen ? 'true' : undefined}>
      {data.map((d, i) => (
        <li key={d.label}>
          <div className={styles.barHead}>
            <span>{d.label}</span>
            <span className={styles.barValue}>{d.sub ? `${d.sub} ・ ` : ''}{format ? format(d.value) : d.value.toLocaleString('ja-JP')}</span>
          </div>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ '--w': `${Math.max(2, (d.value / max) * 100)}%`, '--i': i } as CSSProperties} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 円の進み具合（0〜1）。中央に文字を置ける */
export function Ring({ value, size = 96, label, children }: { value: number; size?: number; label: string; children?: React.ReactNode }) {
  const r = 40
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        <circle cx="50" cy="50" r={r} className={styles.ringTrack} />
        <DrawIn>
          <circle cx="50" cy="50" r={r} pathLength={1} className={styles.ringValue} style={{ strokeDasharray: `${v} 1` } as CSSProperties} transform="rotate(-90 50 50)" />
        </DrawIn>
      </svg>
      {children ? <div className={styles.ringCenter}>{children}</div> : null}
      <span className={styles.srOnly}>{`${Math.round(v * 100)}%`}</span>
    </div>
  )
}

/** 割合の円（3〜5区分まで）。区分は凡例の文字でも区別する */
export function Donut({ data, size = 120, label }: { data: { label: string; value: number }[]; size?: number; label: string }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const tones = ['var(--blue)', 'var(--blue-deep)', 'var(--navy)', 'var(--blue-line)', 'var(--line-strong)']
  let acc = 0
  return (
    <figure className={styles.donut}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
        <circle cx="50" cy="50" r="38" className={styles.ringTrack} />
        {/* 区分ごとに開始位置（dashoffset）を持つので、DrawIn ではなくふわっと出す */}
        <g className={styles.fadeIn}>
          {data.map((d, i) => {
            const part = d.value / total
            const el = <circle key={d.label} cx="50" cy="50" r="38" pathLength={1} fill="none" stroke={tones[i % tones.length]} strokeWidth={14} style={{ strokeDasharray: `${part} 1`, strokeDashoffset: -acc } as CSSProperties} transform="rotate(-90 50 50)" />
            acc += part
            return el
          })}
        </g>
      </svg>
      <figcaption className={styles.legend}>
        {data.map((d, i) => (
          <span key={d.label}><i className={styles.swatch} style={{ background: tones[i % tones.length] }} />{d.label} {Math.round((d.value / total) * 100)}%</span>
        ))}
      </figcaption>
    </figure>
  )
}
