'use client'
// ============================================
// 新しい見た目かどうかを、クライアントの部品に伝える
// ============================================
// 判定はサーバー（src/lib/ui-next.ts の uiNextMode()）。src/app/(shell)/layout.tsx が値を渡す。
// ⚠️ ここでは cookie を読まない。サーバーが決めた値を使うだけ。
import { createContext, useContext } from 'react'
import type { UiNextMode } from '@/lib/ui-next'

export const UiNextContext = createContext<UiNextMode>(null)

/** 新しい見た目（UI 品質の直し）を出すか */
export function useUiNext(): boolean {
  return useContext(UiNextContext) !== null
}

export function useUiNextMode(): UiNextMode {
  return useContext(UiNextContext)
}
