'use client'
// ============================================
// 中身の入れ替えのアニメーション（UI 品質 C-4 ＋ 動きの追加 2026-11-10）
// ============================================
// template はツールを移るたびに作り直される。外枠（AppShell）は layout にあるので動かず、中身だけが入れ替わる。
// - 進む向きに合わせて、右から（進む）・左から（戻る）入る。ブラウザの「戻る」「進む」は popstate で見分ける
// - 不透明度は下げない（空の画面を一瞬も出さない）。位置だけを動かす
// - 横に動かす間だけ overflow-x: clip を付ける（横スクロールの帯が一瞬出ないように）。終わったら外す
// ⚠️ 同じツールの中の移動（/tenjikai/booth → /tenjikai/budget など）では作り直されない（子のセグメントが同じため）。
//    ツールの layout が持つ状態（展示会の画面など）は消えない。
// ⚠️ 新しい見た目（チェックリスト §5.1）でない人には、包みの div も出さない（main と同じ形にする）。
// ⚠️ 動きを減らす設定の人には動かさない（CSS の prefers-reduced-motion）。
import { useEffect, useState, type ReactNode } from 'react'
import styles from './template.module.css'

/** ブラウザの「戻る」「進む」で移ったか（popstate の直後の1回だけ true） */
let historyMove = false
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { historyMove = true })
}

/** 動きの長さ（ms）。template.module.css の --m-dur-slow と同じ */
const ENTER_MS = 420

export default function ShellTemplate({ children }: { children: ReactNode }) {
  // 最初の描画で向きを決める（途中で変えない）。サーバーの描画は常に「進む」
  const [dir] = useState<'forward' | 'back'>(() => (historyMove ? 'back' : 'forward'))
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    historyMove = false
    const t = setTimeout(() => setEntering(false), ENTER_MS + 60)
    return () => clearTimeout(t)
  }, [])
  return <div className={styles.enter} data-dir={dir} data-entering={entering ? 'true' : undefined}>{children}</div>
}
