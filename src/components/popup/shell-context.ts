'use client'

// 共通シェルの中で描かれているか（ページの見出しの大きさを変える）。
// ⚠️ AppShell を読み込まない小さなファイルに分けている（ui.tsx から使っても、シェルが各ページの読み込みに入らないように）
import { createContext, useContext } from 'react'

export const PopupShellContext = createContext(false)

export function useInPopupShell(): boolean {
  return useContext(PopupShellContext)
}
