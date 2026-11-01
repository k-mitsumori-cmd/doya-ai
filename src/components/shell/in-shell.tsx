'use client'
// ============================================
// 「共通の枠の中にいるか」を子に伝える
// ============================================
// 旧来のレイアウト（DashboardLayout など）を、ページ本体が自分で包んでいる画面がある。
// ページ本体は変えない決まりなので、旧来のレイアウトの側がこれを見て、枠の中では中身だけを返す（UI 品質 C-7）。
import { createContext, useContext } from 'react'

export const InShellContext = createContext(false)

export function useInShell(): boolean {
  return useContext(InShellContext)
}
