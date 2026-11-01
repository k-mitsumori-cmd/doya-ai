'use client'
// ============================================
// ペルソナの画面の見出し
// ============================================
// 新しい見た目（チェックリスト §5.1）のときは h2 にする（h1 は枠の ToolFrame が出す。UI 品質 S-57）。
// サーバーで描く画面（料金など）からも使えるよう、判定だけをこの小さな部品に持たせる。
import type { ReactNode } from 'react'

export default function PersonaPageTitle({ className, children }: { className?: string; children: ReactNode }) {
  const Title = 'h2'
  return <Title className={className}>{children}</Title>
}
