'use client'
// ============================================
// アカウントの会社を、枠・ホーム・ツールの見出しに伝える（UI 品質 B-1・B-2）
// ============================================
// 名前はサーバー（src/lib/shell/company.server.ts の getAccountCompanyName()）が決め、(shell)/layout.tsx から渡す。
// どの画面でも同じ名前を出す（1つのアカウントに会社は1つ）。
// 値: undefined … 今の見た目（何も出さない） / null … 会社が見つからない / { name } … 会社の名前
import { createContext, useContext } from 'react'
import type { AccountCompany } from '@/lib/shell/company'

export const AccountCompanyContext = createContext<AccountCompany | null | undefined>(undefined)

export function useAccountCompany(): AccountCompany | null | undefined {
  return useContext(AccountCompanyContext)
}
