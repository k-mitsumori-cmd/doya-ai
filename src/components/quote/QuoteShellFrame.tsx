'use client'

// 共通の枠（src/app/(shell)/layout.tsx）の中に出す、見積のツール内ナビ。
// ⚠️ AppShell で包まない（枠が二重になる）。ToolFrame だけを返す。
import ToolFrame from '@/components/shell/ToolFrame'
import { QUOTE_NAV } from '@/lib/quote/nav'
import QuoteOrgSwitcher from './QuoteOrgSwitcher'

export default function QuoteShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <ToolFrame serviceId="quote" nav={QUOTE_NAV} switcher={<QuoteOrgSwitcher />}>
      {children}
    </ToolFrame>
  )
}
