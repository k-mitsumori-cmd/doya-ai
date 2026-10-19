'use client'
// ============================================
// 新しい見た目のプレビュー中であることを、画面の右下に出す
// ============================================
// 切り替えた本人（UI_NEXT_ROLLOUT=preview）のときだけ出す。全員に出したあと（all）は出さない。
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, Eye } from 'lucide-react'
import { useUiNextMode } from './ui-next-context'
import styles from './UiNextBadge.module.css'

export default function UiNextBadge() {
  const mode = useUiNextMode()
  const pathname = usePathname() || '/home'
  const search = useSearchParams()?.toString()
  if (mode !== 'preview') return null
  const next = encodeURIComponent(search ? `${pathname}?${search}` : pathname)
  return <Badge next={next} />
}

const FOLD_KEY = 'doya_preview_badge_folded'

/** 札の本体。スマホ（767px 以下）では、最初は小さく畳んで出す（画面の中のボタンに重ねないため） */
function Badge({ next }: { next: string }) {
  const [folded, setFolded] = useState(false)
  useEffect(() => {
    let saved: string | null = null
    try { saved = window.sessionStorage.getItem(FOLD_KEY) } catch { /* 覚えられなくても出す */ }
    setFolded(saved != null ? saved === '1' : window.matchMedia('(max-width: 767px)').matches)
  }, [])
  const set = (v: boolean) => {
    setFolded(v)
    try { window.sessionStorage.setItem(FOLD_KEY, v ? '1' : '0') } catch { /* 覚えられなくても動く */ }
  }
  if (folded) {
    return (
      <button type="button" className={`${styles.badge} ${styles.folded}`} onClick={() => set(false)} aria-label="新しい見た目で表示中。押すと、元に戻すボタンが出ます" title="新しい見た目で表示中">
        <Eye size={16} aria-hidden />
      </button>
    )
  }
  return (
    <div className={styles.badge} role="status">
      <span>新しい見た目で表示中</span>
      {/* ⚠️ a で移る（Link だと、表示の判定がサーバーでやり直されないことがある） */}
      <a href={`/api/ui-preview?on=0&next=${next}`} className={styles.back}>元に戻す</a>
      <button type="button" className={styles.fold} onClick={() => set(true)} aria-label="札を小さく畳む"><ChevronDown size={16} aria-hidden /></button>
    </div>
  )
}
