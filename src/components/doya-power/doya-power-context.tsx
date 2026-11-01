'use client'
// ============================================
// ドヤパワーを出すかどうかを、クライアントの部品に伝える
// ============================================
// 判定はサーバー（src/lib/doya-power/flag.ts の isDoyaPowerEnabled()）。src/app/(shell)/layout.tsx が
// ShellGate を通して値を渡す。既定は false（出さない）。
// ⚠️ 新しい見た目（useUiNext()）とは別。新しい見た目は全員に出しているので、ドヤパワーはこの値で出し分ける。
// ⚠️ ここでは cookie も環境変数も読まない。サーバーが決めた値を使うだけ。
import { createContext, useContext, type ReactNode } from 'react'

export const DoyaPowerContext = createContext<boolean>(false)

/** ドヤパワー（残り・減る量・ミッションなど）を出すか */
export function useDoyaPower(): boolean {
  return useContext(DoyaPowerContext)
}

export function DoyaPowerProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <DoyaPowerContext.Provider value={enabled}>{children}</DoyaPowerContext.Provider>
}
