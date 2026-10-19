'use client'

// ============================================
// ドヤ営業管理: ページの見出し
// ============================================
// 新しい見た目（UI 品質 §5.1・S-57）のときは h2。h1 は枠の ToolFrame が出すので、ページで2つ目を出さない。
// ⚠️ 新しい見た目でないときは、今までどおりの h1 と className のまま。
import type { ReactNode } from 'react'
import { useUiNext } from '@/components/shell/ui-next-context'

export default function SfaPageHeading({ children, className = 'text-2xl font-black text-slate-900' }: { children: ReactNode; className?: string }) {
  const uiNext = useUiNext()
  if (uiNext) return <h2 className={`${className.replace(/\btext-2xl\b/, 'text-xl').replace(/\bfont-black\b/, 'font-bold')}`}>{children}</h2>
  return <h1 className={className}>{children}</h1>
}
