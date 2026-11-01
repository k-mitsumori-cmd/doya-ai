'use client'

// 共通シェル（AppShell＋ToolFrame）の中で描かれているか。
// シェルの中では ToolFrame が見出しを出すので、各ページは h1 を出さず小見出し（h2）にする。
// ⚠️ AppShell を読み込まない小さなファイルに分けている（各ページから使っても、シェルが読み込みに入らないように）
import { createContext, useContext } from 'react'

export const ShanaiShellContext = createContext(false)

export function useInShanaiShell(): boolean {
  return useContext(ShanaiShellContext)
}
