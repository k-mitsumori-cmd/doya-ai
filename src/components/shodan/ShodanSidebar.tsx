'use client'

import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Sparkles, Building2, Users, CreditCard, Zap, Target } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { TrialInlineSuffix } from '@/components/TrialCallout'
import { shodanTheme } from '@/components/sidebar/themes'
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
  SidebarUsagePanel,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

interface Props extends SidebarProps {
  orgSlug: string
  orgName?: string
  organizationPlan: string | null
  canManageBilling: boolean
}

function ShodanSidebarImpl({ orgSlug, orgName, organizationPlan, canManageBilling, isCollapsed: controlledIsCollapsed, onToggle, forceExpanded, isMobile }: Props) {
  const pathname = usePathname()
  const { data: session, status: sessionStatus } = useSession()
  // ⚠️ セッション確定前は plan が既定値になり、一瞬だけゲスト扱いの表示が出てしまう。
  //    表示だけを止める（fetch は止めない。Cookie認証なので未確定でも応答する）
  const sessionReady = sessionStatus !== 'loading'
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const base = `/shodan/${encodeURIComponent(orgSlug)}`
  const pricingHref = `/shodan/pricing?org=${encodeURIComponent(orgSlug)}`
  const NAV: NavItem[] = [
    { href: base, label: '商談準備一覧', icon: LayoutDashboard },
    { href: `${base}/new`, label: '新規作成', icon: Sparkles, hot: true },
    { href: `${base}/settings`, label: '自社情報', icon: Building2 },
    { href: `${base}/members`, label: 'メンバー', icon: Users },
    { href: pricingHref, label: '料金プラン', icon: CreditCard },
  ]

  const planLabel = (() => {
    if (!organizationPlan) return '確認中'
    const p = organizationPlan.toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE') return 'PRO'
    if (p === 'LIGHT') return 'LIGHT'
    return 'FREE'
  })()

  const isActive = (href: string) => {
    if (href === base) return pathname === base
    return pathname === href || pathname.startsWith(href + '/')
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/shodan?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={shodanTheme}>
        <SidebarLogoSection icon={Target} title="ドヤ商談準備" subtitle={orgName || orgSlug} showLabel={showLabel} logoSrc="/shodan/logo-sidebar.png" logoClassName="w-full h-auto" logoAspect={{ width: 1936, height: 778 }} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ商談準備" isCollapsed={isCollapsed} theme={shodanTheme} />
            {NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={shodanTheme} layoutId="shodanActiveIndicator" />
            ))}
          </nav>

          {/* プランバナー */}
          {/* 作った数と残り。数字は /api/usage/shodan から受け取るだけ */}
          <SidebarUsagePanel service="shodan" organizationSlug={orgSlug} show={sessionReady && (isMobile || !isCollapsed)} />
          {sessionReady && (isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                    <Zap className="w-4 h-4 text-fuchsia-600 fill-fuchsia-600" />
                  </div>
                  <p className="text-xs font-black text-white">組織のプラン：{planLabel}</p>
                </div>
                <p className="text-[10px] text-purple-100 font-bold leading-relaxed opacity-90 mb-2">
                  {!organizationPlan ? '組織の契約情報を確認できませんでした。'
                    : !canManageBilling ? '利用枠の変更は組織オーナーにご相談ください。'
                      : planLabel === 'PRO' || planLabel === 'ENTERPRISE'
                        ? 'ご利用中のプランの内容をご確認いただけます。'
                        : <>プロプラン ¥9,980/月<TrialInlineSuffix />で利用枠が広がります。</>}
                </p>
                {organizationPlan && <Link href={pricingHref} className="w-full py-2 bg-white text-fuchsia-700 text-[11px] font-black rounded-lg hover:bg-purple-50 transition-colors shadow-md block text-center">
                  {!canManageBilling || planLabel === 'PRO' || planLabel === 'ENTERPRISE' ? 'プランを確認する' : 'プロにアップグレード'}
                </Link>}
              </div>
            </div>
          )}
        </div>

        <ToolSwitcherMenu currentService="shodan" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={shodanTheme}
          loginCallbackUrl="/shodan"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={shodanTheme} />
        <SidebarBrandingFooter brandName="ドヤ商談準備" isCollapsed={isCollapsed} theme={shodanTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={shodanTheme}
      />
    </>
  )
}

export default memo(ShodanSidebarImpl)
