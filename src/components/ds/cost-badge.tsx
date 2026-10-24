'use client'
// ============================================
// ds/cost-badge — ボタンに「減る量」を付ける小さな札
// ============================================
// 使い方: <Button icon="Image">バナーを作る<CostBadge cost={10} /></Button>
//   → 見た目は「バナーを作る［⚡10］」、読み上げは「バナーを作る（ドヤパワーを10使います）」
// - ボタンの色（主・副・枠なし）に合わせて、文字の色（currentColor）から札の色を作る
// - 足りないとき（short）は「足りません」を文字でも出す（色だけで伝えない）
// ⚠️ 数字は props で受け取るだけ。ここで残りを取りに行かない。
// ⚠️ 既存の ds の Button は変えない。子として入れるだけで使える形にしている。
// ⚠️ ドヤパワーの旗（DOYA_POWER_ROLLOUT）が出さないと決めた人には、何も描かない（useDoyaPower()）。
import { Zap } from 'lucide-react'
import { useDoyaPower } from '@/components/doya-power/doya-power-context'
import styles from './cost-badge.module.css'

export function CostBadge({ cost, unitLabel = 'ドヤパワー', short = false, per, halved = false, className }: {
  /** 1回で減る量 */
  cost: number
  /** 読み上げで使う、ポイントの名前 */
  unitLabel?: string
  /** 残りが足りないとき true。札に「足りません」を出す */
  short?: boolean
  /** 単位あたりの量のとき、その単位（例: '分' → 「⚡3/分」、読み上げは「1分ごとにドヤパワーを3使います」。'60分' → 「60分ごとに」） */
  per?: string
  /** 5分以内の作り直しで、半分の量を出しているとき true。札に「半分」を出す（cost には半分にした量を渡す） */
  halved?: boolean
  className?: string
}) {
  const enabled = useDoyaPower()
  if (!enabled) return null
  const n = Math.max(0, Math.round(cost)).toLocaleString('ja-JP')
  return (
    <span className={`${styles.badge} ${className ?? ''}`} data-short={short ? 'true' : undefined}>
      <Zap size={12} strokeWidth={2.25} aria-hidden="true" className={styles.icon} />
      <span aria-hidden="true" className={styles.num}>{n}{per ? `/${per}` : ''}</span>
      {halved ? <span aria-hidden="true" className={styles.half}>半分</span> : null}
      {short ? <span aria-hidden="true" className={styles.short}>足りません</span> : null}
      <span className={styles.sr}>（{halved ? '5分以内の作り直しなので半分の' : ''}{per ? `${/^\d/.test(per) ? '' : '1'}${per}ごとに` : ''}{unitLabel}を{n}使います{short ? '。今は足りません' : ''}）</span>
    </span>
  )
}

export default CostBadge
