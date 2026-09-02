'use client'

// ドヤ広告画像AI サイドバー
// ⚠️ 共通サイドバー部品（src/components/sidebar/）で組む。
//    独自のヘッダーやナビを作らないこと。reference/06-ui-patterns.md §7 が正本。
// ⚠️ ToolSwitcherMenu を必ず含める（他サービスへ移れなくなる）。
import React, { memo, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Megaphone, History, CreditCard, Zap, ImageIcon } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { TrialInlineSuffix } from '@/components/TrialCallout'
import { adimageTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarLogoSection,
  SidebarNavLink,
  SidebarSectionTitle,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarHelpContact,
  SidebarUserProfile,
  SidebarLogoutDialog,
  useSidebarState,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

const BASE = '/adimage'

/** /api/adimage/usage の戻り。limit が null なら上限なし（プロ） */
type Usage = {
  signedIn: boolean
  total: number
  today: { used: number; limit: number | null }
  month: { used: number; limit: number | null }
}

/** 「今日 1 / 3枚（あと2枚）」の1行。残りが尽きたら赤で知らせる */
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit == null) return null
  const rest = Math.max(0, limit - used)
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const empty = rest === 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-bold text-white/80">{label}</span>
        <span className="text-[11px] font-black text-white tabular-nums">
          {used} / {limit}枚
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${empty ? 'bg-rose-300' : 'bg-white'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`mt-1 text-[10px] font-bold ${empty ? 'text-rose-200' : 'text-white/70'}`}>
        {empty ? `${label}の枠を使い切りました` : `あと${rest}枚つくれます`}
      </p>
    </div>
  )
}

function AdImageSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)

  // 生成枚数。生成のたびに変わるので、画面を移動したら取り直す
  // ⚠️ status ではゲートしない。Cookie認証なので未確定でも応答する
  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/api/adimage/usage', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d && !d.error) setUsage(d)
        })
        .catch(() => {
          /* 表示だけの機能なので黙って諦める */
        })
    }
    load()
    // 生成しても画面は移動しないので、完了の合図でも取り直す
    window.addEventListener('adimage:generated', load)
    return () => {
      alive = false
      window.removeEventListener('adimage:generated', load)
    }
  }, [pathname])

  const NAV: NavItem[] = [
    { href: BASE, label: '広告画像をつくる', icon: Megaphone, hot: true },
    { href: BASE + '/history', label: 'これまでの画像', icon: History },
    { href: BASE + '/pricing', label: '料金プラン', icon: CreditCard },
  ]

  const planLabel = (() => {
    if (!isLoggedIn) return 'GUEST'
    const p = String((session?.user as any)?.plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (['PRO', 'BASIC', 'STARTER', 'BUSINESS', 'BUNDLE'].includes(p)) return 'PRO'
    if (p === 'LIGHT') return 'LIGHT'
    return 'FREE'
  })()
  const isPro = planLabel === 'PRO' || planLabel === 'ENTERPRISE'

  const isActive = (href: string) => {
    if (href === BASE) return pathname === BASE
    return pathname === href || pathname.startsWith(href + '/')
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: `${BASE}?loggedOut=1` })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={adimageTheme}>
        <SidebarLogoSection icon={Megaphone} title="ドヤ広告画像AI" showLabel={showLabel} logoSrc="/adimage/logo-sidebar.png" logoClassName="w-full h-auto" logoAspect={{ width: 1993, height: 604 }} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ広告画像AI" isCollapsed={isCollapsed} theme={adimageTheme} />
            {NAV.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                showLabel={showLabel}
                theme={adimageTheme}
                layoutId="adimageActiveIndicator"
              />
            ))}
          </nav>

          {/* 作った枚数と残り。上限は access.ts が正本で、ここでは受け取った数字を出すだけ */}
          {usage && (isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 mt-2 p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-4 h-4 text-white/90 flex-shrink-0" />
                <p className="text-xs font-black text-white">作った画像</p>
              </div>

              <div className="flex items-end gap-1.5 mb-3">
                <span className="text-3xl font-black text-white leading-none tabular-nums">{usage.total}</span>
                <span className="text-[11px] font-bold text-white/70 pb-0.5">枚</span>
              </div>

              {usage.month.limit == null ? (
                <p className="text-[11px] font-bold text-white/85 leading-relaxed">
                  プロプランのため<span className="text-white">枚数の上限はありません</span>
                </p>
              ) : (
                <div className="space-y-2.5">
                  <UsageBar label="今日" used={usage.today.used} limit={usage.today.limit} />
                  <UsageBar label="今月" used={usage.month.used} limit={usage.month.limit} />
                </div>
              )}
            </div>
          )}

          {/* プラン案内。⚠️ 金額の正本は unified-plan.ts。ここに別の数字を書かない */}
          {!isPro && (isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <p className="text-xs font-black text-white">現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}</p>
              </div>
              <p className="text-[10px] text-white/85 font-bold leading-relaxed mb-2">
                プロプラン ¥9,980/月で1日50枚・月300枚まで。ZIP一括もできます<TrialInlineSuffix />
              </p>
              <Link
                href="/adimage/pricing"
                className="block w-full py-2 bg-white text-slate-800 text-[11px] font-black rounded-lg text-center shadow-md transition-colors hover:bg-slate-50"
              >
                プロにアップグレード
              </Link>
            </div>
          )}
        </div>

        <ToolSwitcherMenu currentService="adimage" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={adimageTheme}
          loginCallbackUrl="/adimage"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={adimageTheme} />
        <SidebarBrandingFooter brandName="ドヤ広告画像AI" isCollapsed={isCollapsed} theme={adimageTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={adimageTheme}
      />
    </>
  )
}

export default memo(AdImageSidebarImpl)
