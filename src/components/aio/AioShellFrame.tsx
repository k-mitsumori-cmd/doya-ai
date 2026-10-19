'use client'

// 共通の枠（AppShell）の中に出すドヤAIOのナビ。AppShell では包まない（枠は (shell)/layout.tsx が出す）
// 組織は URL の slug で決まり、組織を切り替える部品は今のドヤAIOに無いので、switcher は渡さない
import { useMemo } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { useUiNext } from '@/components/shell/ui-next-context'
import { buildAioNav } from '@/lib/aio/nav'
import brand from './brand-next.module.css'

export default function AioShellFrame({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const nav = useMemo(() => buildAioNav(orgSlug), [orgSlug])
  // 新しい見た目のときだけ、紫と桃色をブランドの青にそろえる（brand-next.module.css）
  const uiNext = useUiNext()
  return <ToolFrame serviceId="aio" nav={nav}>{uiNext ? <div className={brand.brand}>{children}</div> : children}</ToolFrame>
}
