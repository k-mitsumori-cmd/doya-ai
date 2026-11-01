'use client'
// ============================================
// 勤怠: 新しい見た目（UI 品質の直し）の判定と、ページの見出し
// ============================================
// 新しい見た目は全員に出し終えた。ここでは「共通の枠の中か」だけを見る（未ログインの紹介・料金・招待は枠の外）。
// ⚠️ 枠の中では ToolFrame が h1 を出すので、ページ側の見出しは h2 にする（S-57。h1 は1画面に1つ）。
//    枠の外では h1 のまま。
import type { ReactNode } from 'react'
import { useInShell } from '@/components/shell/in-shell'

export function useToolUiNext(): boolean {
  const inShell = useInShell()
  return inShell
}

export function PageTitle({ className, children }: { className?: string; children: ReactNode }) {
  const next = useToolUiNext()
  const Tag = next ? 'h2' : 'h1'
  return <Tag className={className}>{children}</Tag>
}
