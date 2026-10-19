'use client'

// ============================================
// ドヤAI商談: ページの見出し
// ============================================
// 新しい見た目（UI 品質 §5.1・S-57）のときは h2。h1 は枠の ToolFrame が出すので、ページで2つ目を出さない。
// ⚠️ 新しい見た目でないときは、今までどおりの h1 と className のまま。
import type { ReactNode } from 'react'
import { useUiNext } from '@/components/shell/ui-next-context'

export default function AishodanHeading({ children, className }: { children: ReactNode; className: string }) {
  const uiNext = useUiNext()
  return uiNext ? <h2 className={className}>{children}</h2> : <h1 className={className}>{children}</h1>
}
