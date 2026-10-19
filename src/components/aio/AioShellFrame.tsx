'use client'

// 共通の枠（AppShell）の中に出すドヤAIOのナビ。AppShell では包まない（枠は (shell)/layout.tsx が出す）
// 組織は URL の slug で決まり、組織を切り替える部品は今のドヤAIOに無いので、switcher は渡さない
import { useMemo } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { buildAioNav } from '@/lib/aio/nav'

export default function AioShellFrame({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const nav = useMemo(() => buildAioNav(orgSlug), [orgSlug])
  return <ToolFrame serviceId="aio" nav={nav}>{children}</ToolFrame>
}
