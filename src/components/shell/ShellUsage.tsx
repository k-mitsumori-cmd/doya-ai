'use client'
// ============================================
// ツールの「作った数 / 残り」とプランの表示
// ============================================
// 今のツールのサイドバーにあった表示を、枠の側の1か所で出す。
// - 台帳（registry.ts）の usage があれば、SidebarUsagePanel をそのまま使う（数字の出どころ・読み直しの合図は今と同じ）
// - ツールの中でしか分からない数字（人事の従業員数など）は、ツールが <ShellUsageSlot> で渡す。渡されたらそちらを出す
// ⚠️ 上限に達したときのモーダルは各ツールに残っている。ここは表示だけ。
// ⚠️ 枠の左下には出さない（ツールを押すたびに左下が入れ替わって分かりにくい。2026-10-24 ユーザーの指摘）。
//    ツールの見出しの帯（ToolFrame）の「このツールの残りとプラン」に出す（useToolUsageBody）
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { SidebarUsagePanel } from '@/components/sidebar'
import { useQuoteUsageOrganization } from '@/lib/quote/use-usage-organization'
import { shellServiceForPath, type ShellUsage } from './registry'

type SlotSetter = (node: ReactNode | null) => void
const SetterContext = createContext<SlotSetter | null>(null)
const SlotContext = createContext<ReactNode | null>(null)

/** AppShell の外側に置く。ツールが渡した表示を持つ */
export function ShellUsageProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode | null>(null)
  return (
    <SetterContext.Provider value={setSlot}>
      <SlotContext.Provider value={slot}>{children}</SlotContext.Provider>
    </SetterContext.Provider>
  )
}

/**
 * ツールの側から、枠の左下に表示を渡す。枠の外（設定で無効・未ログイン）では何もしない。
 * 例: <ShellUsageSlot id={JSON.stringify(usage)}><HrUsageMeter … /></ShellUsageSlot>
 */
export function ShellUsageSlot({ id, children }: { id: string; children: ReactNode }) {
  // ⚠️ 中身が変わったときだけ入れ直す。children は描くたびに新しくなるので、id（表示する値をまとめた文字列）で比べる。
  //    毎回入れ直すと、左下の表示が一瞬消えたりずれたりする（UI 品質 C-6）
  const setSlot = useContext(SetterContext)
  const latest = useRef(children)
  latest.current = children
  useEffect(() => {
    setSlot?.(latest.current)
  }, [setSlot, id])
  useEffect(() => () => setSlot?.(null), [setSlot])
  return null
}

/** URL の2つめ（/aio/<組織>/...）を組織として読む */
function orgFromPath(pathname: string): string | null {
  const second = pathname.split('/')[2]
  if (!second) return null
  try {
    return decodeURIComponent(second)
  } catch {
    return null
  }
}

function QuoteUsage({ usage }: { usage: ShellUsage }) {
  const { data: session, status } = useSession()
  const organizationSlug = useQuoteUsageOrganization(session?.user?.id || '', status)
  return <SidebarUsagePanel service={usage.service} refreshEvent={usage.refreshEvent} pricingHref={usage.pricingHref} organizationSlug={organizationSlug} show />
}

/**
 * 今のツールの「作った数 / 残り」とプラン（ツールの見出しの帯に出す中身）。
 * 台帳（registry.ts）に usage が無く、ツールが ShellUsageSlot で渡してもいなければ null（帯に何も出さない）
 */
export function useToolUsageBody(): ReactNode | null {
  const pathname = usePathname() || '/'
  const slot = useContext(SlotContext)
  return usageBody(pathname, slot)
}

function usageBody(pathname: string, slot: ReactNode | null): ReactNode {
  if (slot) return slot
  const usage = shellServiceForPath(pathname)?.usage
  if (!usage) return null
  if (usage.org === 'quote') return <QuoteUsage key={usage.service} usage={usage} />
  const organizationSlug = usage.org === 'path' ? orgFromPath(pathname) : undefined
  return (
    <SidebarUsagePanel
      key={usage.service}
      service={usage.service}
      refreshEvent={usage.refreshEvent}
      pricingHref={usage.pricingHref}
      organizationSlug={organizationSlug}
      show
    />
  )
}
