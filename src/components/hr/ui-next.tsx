'use client'
// ============================================
// 人事: 新しい見た目（UI 品質の直し）の判定と、ページの見出し
// ============================================
// 新しい見た目は「共通の枠の中」かつ「useUiNext() が真」のときだけ（チェックリスト §5.1）。
// ⚠️ 枠の中では ToolFrame が h1 を出すので、ページ側の見出しは h2 にする（S-57。h1 は1画面に1つ）。
//    偽のときは今までどおり h1 のまま（見た目も変えない）。
import type { ReactNode } from 'react'
import { useUiNext } from '@/components/shell/ui-next-context'
import { useInShell } from '@/components/shell/in-shell'

export function useToolUiNext(): boolean {
  const uiNext = useUiNext()
  const inShell = useInShell()
  return uiNext && inShell
}

export function PageTitle({ className, children }: { className?: string; children: ReactNode }) {
  const next = useToolUiNext()
  const Tag = next ? 'h2' : 'h1'
  return <Tag className={className}>{children}</Tag>
}
