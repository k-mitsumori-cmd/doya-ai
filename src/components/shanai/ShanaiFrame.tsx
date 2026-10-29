'use client'

// ============================================
// ドヤ社内インタビュー 外枠の切り替え
// ============================================
// - 回答画面などの第三者向け画面: 枠を出さない（統合仕様 R-7。guest-path.ts）
// - それ以外（ログイン後）: 共通シェル（AppShell＋ToolFrame）。ナビは nav.ts をそのまま渡す
// ⚠️ シェルの中では見出しを ToolFrame の1つにする（各ページは ShanaiShellContext を見て h1 を出さない）
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { SHANAI_NAV } from '@/lib/shanai/nav'
import { ShanaiShellContext } from './shell-context'

// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
export default function ShanaiFrame({ children, preview = false }: { children: ReactNode; preview?: boolean }) {
  const pathname = usePathname()
  if (isGuestPath(pathname)) return <>{children}</>
  if (!preview && pathname?.startsWith('/shanai/dev/')) return <>{children}</>
  return (
    <ToolFrame serviceId="shanai" nav={SHANAI_NAV}>
      <ShanaiShellContext.Provider value={true}>{children}</ShanaiShellContext.Provider>
    </ToolFrame>
  )
}
