'use client'
// ============================================
// ds/Burst — 縁から小さな点が広がるお祝い（手順が済んだ・全部済んだ）
// ============================================
// 点は transform と opacity だけで動く。親の中心から外へ広がり、広がり終えると見えなくなる。
// - 親は position: relative にしておく（点は親の中心に置く）。親の大きさは変えない
// - 動きを減らす設定では出さない（CSS の @media）
// - aria-hidden。意味は隣の文が伝える
// 使い方: <Burst /> / <Burst big delay={300} />
import type { CSSProperties } from 'react'
import styles from './celebrate.module.css'

const COLORS = ['var(--blue, #0066ff)', '#ff1e72', '#ffd400', '#00e0ff']

export function Burst({ big = false, delay = 0, className }: { big?: boolean; delay?: number; className?: string }) {
  const n = big ? 14 : 8
  const r = big ? 46 : 22
  return (
    <span className={`${styles.burst} ${className ?? ''}`} aria-hidden style={{ '--cel-delay': `${delay}ms` } as CSSProperties}>
      <i className={styles.ring} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2
        // 1つおきに少し遠くへ。丸くそろいすぎないようにする
        const d = i % 2 === 0 ? r : r * 0.72
        return (
          <i key={i} className={styles.dot} style={{
            '--dx': `${Math.round(Math.cos(a) * d)}px`, '--dy': `${Math.round(Math.sin(a) * d)}px`,
            '--cel-color': COLORS[i % COLORS.length], '--cel-i': i,
          } as CSSProperties} />
        )
      })}
    </span>
  )
}
