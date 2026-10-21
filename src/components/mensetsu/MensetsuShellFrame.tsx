'use client'

import { usePathname } from 'next/navigation'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { MENSETSU_NAV } from '@/lib/mensetsu/nav'
import { useToolUiNext } from './ui-next'
import nextStyles from './mensetsu-next.module.css'
import MensetsuOrgSwitcher from './MensetsuOrgSwitcher'
import { useOptionalMensetsuWorkspace } from './MensetsuWorkspaceBoundary'

// 共通の枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここは ToolFrame だけを返す。
export default function MensetsuShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const uiNext = useToolUiNext()
  const workspace = useOptionalMensetsuWorkspace()
  const proof = workspace?.scope.kind === 'ready' ? workspace.scope.proof : null
  // ⚠️ 候補者が開く面接の画面と招待の画面には、ツール内のナビも出さない（MensetsuAppLayout と同じ判定）
  if (isGuestPath(pathname)) return <>{children}</>
  return (
    <ToolFrame serviceId="mensetsu" nav={proof ? MENSETSU_NAV.map(item => ({ ...item, href: proof.href(item.href) })) : []} switcher={<MensetsuOrgSwitcher />}>
      {uiNext ? <div className={nextStyles.scope}>{children}</div> : children}
    </ToolFrame>
  )
}
