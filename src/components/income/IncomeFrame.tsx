'use client'
// ドヤ収入管理: ToolFrame にナビを渡すだけの部品
// ⚠️ ナビのアイコン（lucide の関数）はサーバーからクライアントへ渡せないので、ここで import して渡す。
//    layout.tsx（サーバー）から nav を直接渡すと全画面が 500 になる。
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { INCOME_NAV } from '@/lib/income/nav'
import tokens from './tokens.module.css'

export default function IncomeFrame({ children }: { children: ReactNode }) {
  return (
    <ToolFrame serviceId="income" nav={INCOME_NAV}>
      {/* tokens.ds は ds のトークンに --bad-* を足したもの。ds 側に入ったら外す */}
      <div className={tokens.ds}>{children}</div>
    </ToolFrame>
  )
}
