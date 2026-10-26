'use client'
// ============================================
// ds/infographic — インフォグラフィックの部品（2026-10-27）
// ============================================
// ユーザー「全体的にインフォグラフィックのアニメーションとグラデーションを使って、分かりやすく見やすくしてほしい」。
// - InfoPanel: グラデーションの帯の見出しを持つカード（グラフをまとめる枠）
// - Pictogram: 人の形を区分ごとの色で並べる（出勤の状況・部署の人数など）。画面に入ると順に跳ねて出る
// - BigFigure: 大きな数字（数え上げ）と、その下の一言
// ⚠️ 動きは位置と大きさだけ（止まる環境でも中身は見える。F-12）。動きを減らす設定では動かさない
// ⚠️ 色はトークン（--blue など）。色だけで伝えず、凡例の文字と数も出す
import type { CSSProperties, ReactNode } from 'react'
import { CountUp, useInViewOnce } from './motion'
import { seriesColor, type ChartTone } from './chart-math'
import styles from './infographic.module.css'

/** グラデーションの帯の見出しを持つカード */
export function InfoPanel({ title, meta, children, className }: {
  title: ReactNode
  /** 見出しの右の小さな文字（期間など） */
  meta?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${styles.panel} ${className ?? ''}`}>
      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {meta ? <span className={styles.panelMeta}>{meta}</span> : null}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  )
}

/** 大きな数字（数え上げ）と、その下の一言 */
export function BigFigure({ value, unit, label, format, tone }: {
  value: number
  unit?: string
  label: ReactNode
  format?: (n: number) => string
  tone?: ChartTone | string
}) {
  return (
    <div className={styles.figure}>
      <span className={styles.figureValue} style={tone ? { color: seriesColor(0, tone) } : undefined}>
        <CountUp value={value} format={format} />
        {unit ? <span className={styles.figureUnit}>{unit}</span> : null}
      </span>
      <span className={styles.figureLabel}>{label}</span>
    </div>
  )
}

/** 人の形（頭と体）。aria-hidden で使う */
function Person({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 32" width="100%" height="100%" aria-hidden>
      <circle cx="12" cy="8" r="6" fill={color} />
      <path d="M2 30c0-7 4.5-12 10-12s10 5 10 12z" fill={color} />
    </svg>
  )
}

/**
 * 人の形を区分ごとの色で並べる（ピクトグラム）。
 * - 1人を1つの形で出す（max を超えたら、1つの形が何人かを凡例に出す）
 * - 凡例に区分の名前と人数を出す（色だけで伝えない）
 */
export function Pictogram({ groups, label, max = 60 }: {
  groups: { label: string; count: number; tone?: ChartTone | string }[]
  label: string
  /** 並べる形の数の上限 */
  max?: number
}) {
  const { ref, seen } = useInViewOnce<HTMLDivElement>()
  const total = groups.reduce((a, g) => a + Math.max(0, g.count), 0)
  const per = total > max ? Math.ceil(total / max) : 1
  const items: { color: string; key: string }[] = []
  groups.forEach((g, gi) => {
    const n = Math.round(Math.max(0, g.count) / per)
    for (let i = 0; i < n; i++) items.push({ color: seriesColor(gi, g.tone), key: `${gi}-${i}` })
  })
  return (
    <figure className={styles.picto} aria-label={label}>
      <div ref={ref} className={styles.people} data-seen={seen ? 'true' : undefined} aria-hidden>
        {items.map((it, i) => (
          <span key={it.key} className={styles.person} style={{ '--i': i } as CSSProperties}><Person color={it.color} /></span>
        ))}
      </div>
      <figcaption className={styles.pictoLegend}>
        {groups.map((g, gi) => (
          <span key={g.label} className={styles.pictoItem}>
            <i className={styles.dot} style={{ background: seriesColor(gi, g.tone) }} />
            {g.label}
            <b className={styles.pictoCount}>{g.count}<small>名</small></b>
          </span>
        ))}
        {per > 1 ? <span className={styles.pictoNote}>形1つで{per}名</span> : null}
      </figcaption>
    </figure>
  )
}

/** 読み込みの間に、同じ見出しと高さの枠を出しておく（読み込みのあとに下を押し下げない） */
export function InfoPanelLoading({ title, height }: { title: ReactNode; height: number }) {
  return (
    <InfoPanel title={title}>
      <div aria-busy="true" aria-label="読み込み中" className={styles.loading} style={{ height }} />
    </InfoPanel>
  )
}
