'use client'

// 共通の枠（src/app/(shell)/layout.tsx）の中に出す、見積のツール内ナビ。
// ⚠️ AppShell で包まない（枠が二重になる）。ToolFrame だけを返す。
import { usePathname } from 'next/navigation'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { QUOTE_NAV } from '@/lib/quote/nav'
import QuoteOrgSwitcher from './QuoteOrgSwitcher'
import { useOptionalQuoteWorkspace } from './QuoteWorkspaceBoundary'

const DEV_PREVIEW = /^\/quote\/dev(\/|$)/

export default function QuoteShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const workspace = useOptionalQuoteWorkspace()
  const proof = workspace?.scope.kind === 'ready' ? workspace.scope.proof : null
  // 招待の受諾（/quote/invite/<token>）など第三者が開く画面には、ツール内のナビも組織の切り替えも出さない（点検 SAL-020）
  if (isGuestPath(pathname)) return <>{children}</>
  // 開発時だけの見本（/quote/dev/...）は自分で枠を描く（ログイン中に開いても枠が二重にならないように）
  if (DEV_PREVIEW.test(pathname || '')) return <>{children}</>
  return (
    <ToolFrame serviceId="quote" nav={proof ? QUOTE_NAV.map(item => ({ ...item, href: proof.href(item.href) })) : []} switcher={<QuoteOrgSwitcher />}>
      {children}
    </ToolFrame>
  )
}
