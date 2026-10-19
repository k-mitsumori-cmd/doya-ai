'use client'
// ============================================
// 中身の入れ替えのアニメーション（UI 品質 C-4）
// ============================================
// template はツールを移るたびに作り直される。外枠（AppShell）は layout にあるので動かず、中身だけが少し上がって入る。
// ⚠️ 同じツールの中の移動（/tenjikai/booth → /tenjikai/budget など）では作り直されない（子のセグメントが同じため）。
//    ツールの layout が持つ状態（展示会の画面など）は消えない。
// ⚠️ 新しい見た目（チェックリスト §5.1）でない人には、包みの div も出さない（main と同じ形にする）。
// ⚠️ 動きを減らす設定の人には動かさない（CSS の prefers-reduced-motion）。
import type { ReactNode } from 'react'
import { useUiNext } from '@/components/shell/ui-next-context'
import styles from './template.module.css'

export default function ShellTemplate({ children }: { children: ReactNode }) {
  const uiNext = useUiNext()
  if (!uiNext) return <>{children}</>
  return <div className={styles.enter}>{children}</div>
}
