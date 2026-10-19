'use client'
// ============================================
// 新しい見た目のプレビュー中であることを、画面の右下に出す
// ============================================
// 切り替えた本人（UI_NEXT_ROLLOUT=preview）のときだけ出す。全員に出したあと（all）は出さない。
import { usePathname, useSearchParams } from 'next/navigation'
import { useUiNextMode } from './ui-next-context'
import styles from './UiNextBadge.module.css'

export default function UiNextBadge() {
  const mode = useUiNextMode()
  const pathname = usePathname() || '/home'
  const search = useSearchParams()?.toString()
  if (mode !== 'preview') return null
  const next = encodeURIComponent(search ? `${pathname}?${search}` : pathname)
  return (
    <div className={styles.badge} role="status">
      <span>新しい見た目で表示中</span>
      {/* ⚠️ a で移る（Link だと、表示の判定がサーバーでやり直されないことがある） */}
      <a href={`/api/ui-preview?on=0&next=${next}`} className={styles.back}>元に戻す</a>
    </div>
  )
}
