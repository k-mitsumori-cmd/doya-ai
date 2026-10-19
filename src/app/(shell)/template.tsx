// ============================================
// 中身の入れ替えのアニメーション（UI 品質 C-4）
// ============================================
// template はツールを移るたびに作り直される。外枠（AppShell）は layout にあるので動かず、中身だけがふわっと入る。
// ⚠️ 同じツールの中の移動（/tenjikai/booth → /tenjikai/budget など）では作り直されない（子のセグメントが同じため）。
//    ツールの layout が持つ状態（展示会の画面など）は消えない。
// ⚠️ 動きを減らす設定の人には動かさない（CSS の prefers-reduced-motion）。
import type { ReactNode } from 'react'
import styles from './template.module.css'

export default function ShellTemplate({ children }: { children: ReactNode }) {
  return <div className={styles.enter}>{children}</div>
}
