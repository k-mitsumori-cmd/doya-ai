'use client'
// ============================================
// 枠の左下の「作った数 / 残り」とプランの表示
// ============================================
// 今のツールのサイドバーにあった表示を、枠の側の1か所で出す。
// - 台帳（registry.ts）の usage があれば、SidebarUsagePanel をそのまま使う（数字の出どころ・読み直しの合図は今と同じ）
// - ツールの中でしか分からない数字（人事の従業員数など）は、ツールが <ShellUsageSlot> で渡す。渡されたらそちらを出す
// ⚠️ 上限に達したときのモーダルは各ツールに残っている。ここは表示だけ。
// ⚠️ 新しい見た目では、左下には出さない（ツールを押すたびに左下が入れ替わって分かりにくい。2026-10-24 ユーザーの指摘）。
//    ツールの見出しの帯（ToolFrame）の「このツールの残りとプラン」に出す（useToolUsageBody）。今の見た目は左下のまま（ShellUsageArea）
// ⚠️ ツールのタブには料金プランを入れない（FRM-04）。代わりに、ここにいつもそのツールの料金のページへのリンクを出す
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { SidebarUsagePanel } from '@/components/sidebar'
import { useQuoteUsageOrganization } from '@/lib/quote/use-usage-organization'
import { shellServiceForPath, toolPricingHref, type ShellUsage } from './registry'
import { useUiNext } from './ui-next-context'

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
 * 台帳から、今のツールの利用量を出す。ツールが ShellUsageSlot で渡していれば、そちらを優先する。
 * ⚠️ SidebarUsagePanel は色つきのサイドバー用（白い文字）なので、青いカードの上に置く（className は AppShell が渡す）
 */
export function ShellUsageArea({ className }: { className?: string }) {
  const pathname = usePathname() || '/'
  const slot = useContext(SlotContext)
  const body = usageBody(pathname, slot)
  // ⚠️ SidebarUsagePanel は、読み直しの間は何も描かない（古い数字を出さないため。verify-sidebar-usage-mounted）。
  //    そのたびに高さが0になると、下の行が上にずれる。同じツールの間は、直前の高さを保つ（UI 品質 C-6）
  const uiNext = useUiNext()
  const holdKey = slot ? 'slot' : shellServiceForPath(pathname)?.usage?.service ?? ''
  const ref = useRef<HTMLDivElement | null>(null)
  const [held, setHeld] = useState<{ key: string; height: number }>({ key: '', height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      if (h > 8) setHeld((prev) => (prev.key === holdKey && Math.abs(prev.height - h) < 1 ? prev : { key: holdKey, height: h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [holdKey])
  if (!body) return null
  // ⚠️ 高さを保つのは、新しい見た目（チェックリスト §5.1）のときだけ
  const minHeight = uiNext && held.key === holdKey && held.height > 0 ? held.height : undefined
  return <div ref={ref} className={className} data-hold={minHeight ? 'true' : undefined} style={minHeight ? { minHeight } : undefined}>{body}</div>
}

/**
 * 今のツールの「作った数 / 残り」とプラン（新しい見た目で、ツールの見出しの帯に出す中身）。
 * 台帳（registry.ts）に usage が無く、ツールが ShellUsageSlot で渡してもいなければ null（帯に何も出さない）
 */
export function useToolUsageBody(): ReactNode | null {
  const pathname = usePathname() || '/'
  const slot = useContext(SlotContext)
  return usageBody(pathname, slot)
}

function usageBody(pathname: string, slot: ReactNode | null): ReactNode {
  if (slot) return slot
  const svc = shellServiceForPath(pathname)
  const usage = svc?.usage
  if (!svc || !usage) return null
  if (usage.org === 'quote') return <QuoteUsage key={usage.service} usage={usage} />
  const organizationSlug = usage.org === 'path' ? orgFromPath(pathname) : undefined
  return (
    <SidebarUsagePanel
      key={usage.service}
      service={usage.service}
      refreshEvent={usage.refreshEvent}
      pricingHref={toolPricingHref(svc, organizationSlug)}
      pricingLabel={organizationSlug ? undefined : 'プランと料金を見る'}
      organizationSlug={organizationSlug}
      show
    />
  )
}
