'use client'

import { usePathname } from 'next/navigation'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { MENSETSU_NAV } from '@/lib/mensetsu/nav'
import { useToolUiNext } from './ui-next'
import nextStyles from './mensetsu-next.module.css'

// 共通の枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここは ToolFrame だけを返す。
// ドヤ面接官には組織の切り替え部品がない（組織は ?org= とヘッダー x-mensetsu-org で API が解決する）ため switcher は渡さない。
export default function MensetsuShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const uiNext = useToolUiNext()
  // ⚠️ 候補者が開く面接の画面と招待の画面には、ツール内のナビも出さない（MensetsuAppLayout と同じ判定）
  if (isGuestPath(pathname)) return <>{children}</>
  return (
    <ToolFrame serviceId="mensetsu" nav={MENSETSU_NAV}>
      {uiNext ? <div className={nextStyles.scope}>{children}</div> : children}
    </ToolFrame>
  )
}
