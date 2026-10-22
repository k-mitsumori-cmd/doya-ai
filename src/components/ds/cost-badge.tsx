// ============================================
// ds/cost-badge — ボタンに「減る量」を付ける小さな札
// ============================================
// 使い方: <Button icon="Image">バナーを作る<CostBadge cost={10} /></Button>
//   → 見た目は「バナーを作る［⚡10］」、読み上げは「バナーを作る（ドヤパワーを10使います）」
// - ボタンの色（主・副・枠なし）に合わせて、文字の色（currentColor）から札の色を作る
// - 足りないとき（short）は「足りません」を文字でも出す（色だけで伝えない）
// ⚠️ 数字は props で受け取るだけ。ここで残りを取りに行かない。
// ⚠️ 既存の ds の Button は変えない。子として入れるだけで使える形にしている。
import { Zap } from 'lucide-react'
import styles from './cost-badge.module.css'

export function CostBadge({ cost, unitLabel = 'ドヤパワー', short = false, className }: {
  /** 1回で減る量 */
  cost: number
  /** 読み上げで使う、ポイントの名前 */
  unitLabel?: string
  /** 残りが足りないとき true。札に「足りません」を出す */
  short?: boolean
  className?: string
}) {
  const n = Math.max(0, Math.round(cost)).toLocaleString('ja-JP')
  return (
    <span className={`${styles.badge} ${className ?? ''}`} data-short={short ? 'true' : undefined}>
      <Zap size={12} strokeWidth={2.25} aria-hidden="true" className={styles.icon} />
      <span aria-hidden="true" className={styles.num}>{n}</span>
      {short ? <span aria-hidden="true" className={styles.short}>足りません</span> : null}
      <span className={styles.sr}>（{unitLabel}を{n}使います{short ? '。今は足りません' : ''}）</span>
    </span>
  )
}

export default CostBadge
