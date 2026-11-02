'use client'
// 旗 ONE_BUTTON_ROLLOUT の判定（サーバーが決めて ShellGate が渡す）。各ツールの画面は useOneButton() で読む
import { createContext, useContext } from 'react'

export const OneButtonContext = createContext(false)

export function useOneButton(): boolean {
  return useContext(OneButtonContext)
}

/** サーバーの部品（layout）から旗を渡すための包み（サーバーの部品は Context.Provider を直接使えないため） */
export function OneButtonProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <OneButtonContext.Provider value={value}>{children}</OneButtonContext.Provider>
}
