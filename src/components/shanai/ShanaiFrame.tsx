'use client'

// ============================================
// ドヤ社内インタビュー 外枠の切り替え
// ============================================
// - 回答画面などの第三者向け画面: 枠を出さない（統合仕様 R-7。guest-path.ts）
// - ui.shell.shanai=ON: 共通シェル（AppShell＋ToolFrame）。ナビは nav.ts をそのまま渡す
// - OFF: 暫定の ShanaiAppLayout（nav.ts を描くだけのサイドバー）
// ⚠️ ON / OFF の判定はサーバー（layout.tsx）で行い、結果だけを受け取る
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import { isGuestPath } from '@/lib/ui/guest-path'
import { SHANAI_NAV } from '@/lib/shanai/nav'
import ShanaiAppLayout from './ShanaiAppLayout'

export default function ShanaiFrame({ shell, userName, children }: { shell: boolean; userName?: string | null; children: ReactNode }) {
  const pathname = usePathname()
  if (isGuestPath(pathname)) return <>{children}</>
  if (!shell) return <ShanaiAppLayout>{children}</ShanaiAppLayout>
  return (
    <AppShell userName={userName}>
      <ToolFrame serviceId="shanai" description="録音かアンケートと写真から、会社の魅力が伝わる社員インタビュー記事を作ります。" nav={SHANAI_NAV}>
        {children}
      </ToolFrame>
    </AppShell>
  )
}
