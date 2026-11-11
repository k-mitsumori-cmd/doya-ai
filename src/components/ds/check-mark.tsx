'use client'
// ============================================
// ds/check-mark — 描かれるチェックの印（保存できた・できた・手順が終わった）
// ============================================
// 円が弾んで現れ、そのあとでチェックの線が描かれる。縁から光の輪が1回だけ広がる。
// - 動かすのは transform / opacity / stroke-dashoffset だけ。大きさは決めてあるので、レイアウトは動かない
// - 動きを減らす設定では、描き終わった形ですぐ出す（CSS の @media）
// - 読み上げ用の文字は出さない（aria-hidden）。意味は、隣の文（「保存しました」など）が伝える
// 使い方: <CheckMark size={18} /> / <CheckMark size={28} burst />
import type { CSSProperties } from 'react'
import styles from './check-mark.module.css'

export function CheckMark({ size = 18, burst = false, className }: {
  size?: number
  /** 縁から光の輪を広げる（お祝いのとき） */
  burst?: boolean
  className?: string
}) {
  return (
    <span className={`${styles.root} ${className ?? ''}`} style={{ '--cm-size': `${size}px` } as CSSProperties} aria-hidden>
      {burst ? <i className={styles.ring} /> : null}
      <svg className={styles.svg} viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle className={styles.disc} cx="12" cy="12" r="11" fill="currentColor" />
        <path className={styles.tick} d="M7 12.5l3.2 3.2L17 8.8" pathLength={1} stroke="var(--cm-tick, #fff)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
