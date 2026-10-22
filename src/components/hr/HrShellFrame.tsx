'use client'

// ============================================
// ドヤHR 共通の枠に載せたときの外側（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは包まない（二重になるため）
// ⚠️ 組織の読み込み・選択・HrOrganizationScope・HrOnboarding は HrLayout がそのまま持つ。
//    HrLayout が組織の切り替え（<select>）を switcher として渡し、ここで ToolFrame に入れる
import type { ReactNode } from 'react'
import Link from 'next/link'
import ToolFrame from '@/components/shell/ToolFrame'
import { ShellUsageSlot } from '@/components/shell/ShellUsage'
import { planLabel, tierFrom } from '@/lib/plan-utils'
import { hrShellNav } from '@/lib/hr/nav'
import HrLayout from './HrLayout'
import { useToolUiNext } from './ui-next'

export default function HrShellFrame({ children }: { children: ReactNode }) {
  // 新しい見た目では「従業員を追加」をタブに出さない（/hr/employees/new でタブが2つ選ばれる S-33）。追加はダッシュボードと一覧の主ボタンから
  const uiNext = useToolUiNext()
  return (
    <HrLayout
      renderFrame={({ switcher, canManageEmployees, usage, children: content }) => (
        <>
          {/* サイドバーにあった従業員数のメーターとプランを、枠の左下に出す */}
          {usage ? <ShellUsageSlot id={JSON.stringify(usage)}><HrUsageMeter {...usage} /></ShellUsageSlot> : null}
          <ToolFrame serviceId="hr" title="ドヤHR" nav={hrShellNav(canManageEmployees && !uiNext)} switcher={switcher}>
            {content}
          </ToolFrame>
        </>
      )}
    >
      {children}
    </HrLayout>
  )
}

/** 従業員数のメーター（枠の左下の青いカードの上に出すので、白い文字にする） */
function HrUsageMeter({ employeeCount, employeeLimit, plan }: { employeeCount: number; employeeLimit: number; plan: string }) {
  const unlimited = employeeLimit < 0
  const ratio = unlimited || employeeLimit === 0 ? 0 : Math.min(1, employeeCount / employeeLimit)
  return (
    <div className="mx-3 mt-2 rounded-xl border border-white/20 bg-white/10 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-bold text-white/80">登録した従業員</span>
        <span className="text-[11px] font-black tabular-nums text-white">{employeeCount}{unlimited ? ' 名' : ` / ${employeeLimit} 名`}</span>
      </div>
      {unlimited ? null : (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-white/80">
        <span>{planLabel(tierFrom(plan))}プラン</span>
        <Link href="/hr/pricing" className="underline underline-offset-2">プランを見る</Link>
      </div>
    </div>
  )
}
