'use client'
// プロマネの各画面の見出し。新しい見た目では、枠（ToolFrame）が h1 を持つので h2 にする（UI 品質 S-57）。
// 偽のときは今までどおり h1。
import type { ReactNode } from 'react'

export default function PromanePageHeading({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={className}>{children}</h2>
}
