'use client'

import React, { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Sparkles,
  Palette,
  CreditCard,
  Zap,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import SidebarTour from '@/components/SidebarTour'
import MobileTourPopup, { BANNER_TOUR_SLIDES } from '@/components/MobileTourPopup'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { dashboardTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarLogoSection,
  SidebarSectionTitle,
  SidebarNavLink,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarHelpContact,
  SidebarUserProfile,
  SidebarLogoutDialog,
  useSidebarState,
  useFreeHour,
  formatRemainingTime,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'

const bannerNavItems: NavItem[] = [
  { href: '/banner/dashboard', label: '選んで生成', icon: Sparkles, hot: true },
  { href: '/banner/dashboard/create', label: '0からバナー作成', icon: Palette },
  { href: '/banner/dashboard/plan', label: 'プラン・使用量', icon: CreditCard },
]

const seoNavItems: NavItem[] = [
  { href: '/seo/create', label: '新規記事作成', icon: Sparkles },
  { href: '/seo', label: '生成記事一覧', icon: LayoutDashboard },
]

function DashboardSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle, expand } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const bannerPlanLabel = useMemo(() => {
    const bannerPlan = String((session?.user as any)?.bannerPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = bannerPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [session, isLoggedIn])

  const nextBannerPlanLabel = useMemo(() => {
    if (bannerPlanLabel === 'GUEST' || bannerPlanLabel === 'FREE') return 'PRO'
    if (bannerPlanLabel === 'PRO') return 'ENTERPRISE'
    return 'CONSULT'
  }, [bannerPlanLabel])

  // 1時間生成し放題
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const { isFreeHourActive, freeHourRemainingMs } = useFreeHour(firstLoginAt)

  const isBanner = useMemo(() => pathname.startsWith('/banner'), [pathname])
  const activeNavItems = useMemo(() => (isBanner ? bannerNavItems : seoNavItems), [isBanner])

  const postLogoutUrl = useMemo(() => {
    if (pathname.startsWith('/banner')) return '/banner?loggedOut=1'
    if (pathname.startsWith('/kantan')) return '/kantan/dashboard?loggedOut=1'
    if (pathname.startsWith('/seo')) return '/seo?loggedOut=1'
    return '/?loggedOut=1'
  }, [pathname])

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      markLogoutToastPending()
      await signOut({ callbackUrl: postLogoutUrl })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const isActive = (href: string) => {
    const base = href.split('#')[0]
    if (base === '/banner' || base === '/banner/dashboard' || base === '/seo') {
      return pathname === base
    }
    return pathname.startsWith(base)
  }

  // Dashboard固有: PC/モバイル分離の生成し放題バナー
  const FreeHourCampaignBanner = () => {
    if (!isFreeHourActive || freeHourRemainingMs <= 0) return null
    if (!showLabel) return null

    return (
      <div className="mx-3 md:mx-4 mt-3 md:mt-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-red-400 border border-amber-300/50 relative overflow-hidden shadow-lg shadow-amber-500/20">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        {/* PC用表示 */}
        <div className="hidden md:block relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-lg">🚀</span>
            </div>
            <div>
              <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/90 font-bold">全機能解放</p>
            <div className="px-2 py-1 bg-white/30 rounded-lg backdrop-blur-sm">
              <p className="text-sm font-black text-white tabular-nums drop-shadow-sm">
                残り {formatRemainingTime(freeHourRemainingMs)}
              </p>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-white/80 font-bold space-y-0.5">
            <p>✓ 最大10枚生成</p>
            <p>✓ サイズ指定OK</p>
            <p>✓ 履歴機能解放</p>
          </div>
        </div>
        {/* スマホ用表示 */}
        <div className="md:hidden relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <span className="text-xl">🚀</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
            <p className="text-[10px] text-white/80 font-bold">全機能解放 / 履歴OK</p>
          </div>
          <div className="px-2.5 py-1.5 bg-white/30 rounded-lg backdrop-blur-sm flex-shrink-0">
            <p className="text-sm font-black text-white tabular-nums drop-shadow-sm">
              {formatRemainingTime(freeHourRemainingMs)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard固有: 多段プラン案内バナー
  const SidebarBanner = () => {
    if (isFreeHourActive && freeHourRemainingMs > 0) return null
    if (!showLabel) return null

    return (
      <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden group">
        {/* PC用：縦レイアウト */}
        <div className="hidden md:block relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
              <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
            </div>
            <p className="text-xs font-black text-white">プラン案内</p>
          </div>
          <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
            現在：{bannerPlanLabel === 'GUEST' ? 'ゲスト' : bannerPlanLabel}
          </p>
          <p className="text-[10px] text-blue-100 font-bold leading-relaxed opacity-80">
            {nextBannerPlanLabel === 'PRO' && <>次の上位：PRO（¥9,980/月）</>}
            {nextBannerPlanLabel === 'ENTERPRISE' && <>次の上位：Enterprise（¥49,800/月）</>}
            {nextBannerPlanLabel === 'CONSULT' && <>さらに上限UP：要相談</>}
          </p>
          {nextBannerPlanLabel === 'CONSULT' ? (
            <a
              href={HIGH_USAGE_CONTACT_URL}
              target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
              rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
            >
              <button className="mt-3 w-full py-2 bg-white text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md">
                マーケティング丸投げ相談
              </button>
            </a>
          ) : (
            <Link
              href="/banner/dashboard/plan"
              className="mt-3 w-full py-2 bg-white text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md block text-center"
            >
              {nextBannerPlanLabel === 'PRO' ? 'PROを始める' : 'Enterpriseへ'}
            </Link>
          )}
        </div>
        {/* スマホ用：横1行コンパクト表示 */}
        <Link
          href={nextBannerPlanLabel === 'CONSULT' ? HIGH_USAGE_CONTACT_URL : '/banner/dashboard/plan'}
          className="md:hidden relative z-10 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white font-bold leading-snug truncate">
              {bannerPlanLabel === 'GUEST' ? 'ゲスト' : bannerPlanLabel}
              {nextBannerPlanLabel === 'PRO' && ' → PRO'}
              {nextBannerPlanLabel === 'ENTERPRISE' && ' → Enterprise'}
              {nextBannerPlanLabel === 'CONSULT' && ' ✓'}
            </p>
          </div>
          <span className="flex-shrink-0 px-3 py-1.5 bg-white text-blue-600 text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md whitespace-nowrap">
            {nextBannerPlanLabel === 'CONSULT' ? '相談' : 'UP'}
          </span>
        </Link>
      </div>
    )
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={dashboardTheme}>
        <SidebarLogoSection icon={Sparkles} title="ドヤバナーAI" showLabel={showLabel} />

        <nav className="flex-1 overflow-y-auto py-4 sm:py-6 px-3 space-y-1 custom-scrollbar">
          <div className="space-y-1">
            <SidebarSectionTitle title={isBanner ? "ドヤバナーAI" : "ドヤライティングAI"} isCollapsed={isCollapsed} theme={dashboardTheme} />
            {activeNavItems.map((item) => (
              <SidebarNavLink
                key={item.href + item.label}
                item={item}
                isActive={isActive(item.href)}
                showLabel={showLabel}
                theme={dashboardTheme}
                layoutId="activeIndicator"
                dataTourNav={item.href.split('#')[0]}
              />
            ))}
          </div>
        </nav>

        {/* 1時間生成し放題キャンペーンバナー */}
        <FreeHourCampaignBanner />

        {/* Side Banner（プラン案内） */}
        <SidebarBanner />

        <ToolSwitcherMenu currentService="banner" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={dashboardTheme}
          settingsHref="/banner/dashboard/settings"
          loginCallbackUrl={pathname || '/banner'}
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={dashboardTheme} />
        <SidebarBrandingFooter brandName="ドヤバナーAI" isCollapsed={isCollapsed} theme={dashboardTheme} />
      </SidebarShell>

      {/* 右下の?＋初回ログイン時のサイドバー＋画面全体ツアー */}
      <SidebarTour
        storageKey={`doya_sidebar_tour_${isBanner ? 'banner' : 'seo'}_${String((session?.user as any)?.id || 'guest')}`}
        autoStart={!!session?.user}
        onEnsureExpanded={expand}
        items={[
          ...(isBanner
            ? [
                {
                  id: 'gallery-grid',
                  label: 'ギャラリーからスタイルを選ぶ',
                  description:
                    'プロ品質のバナーテンプレートが一覧で並んでいます。好みのデザインをクリックしてプレビューしましょう。',
                  targetSelector: '[data-tour="gallery-grid"]',
                  allowMissing: true,
                },
                {
                  id: 'filter-tabs',
                  label: 'ジャンルで絞り込む',
                  description:
                    '上部のタブで「食品・飲料」「ビジネス」「美容」などジャンル別に絞り込めます。',
                  targetSelector: '[data-tour="filter-tabs"]',
                  allowMissing: true,
                },
                {
                  id: 'hero-preview',
                  label: 'クリックでプレビュー表示',
                  description:
                    'テンプレートをクリックすると上部にプレビューが表示されます。「このスタイルで生成」ボタンから生成に進めます。',
                  targetSelector: '[data-tour="hero-preview"]',
                  allowMissing: true,
                },
                {
                  id: 'generate-style',
                  label: '「このスタイルで生成」で生成開始',
                  description:
                    'プレビュー表示中に青いボタンを押すと、生成フォームが表示されます。テキストやサイズをカスタマイズできます。',
                  targetSelector: '[data-tour="generate-style"]',
                  allowMissing: true,
                },
                {
                  id: 'generation-form',
                  label: 'テキスト・サイズを設定して生成',
                  description:
                    '見出しテキスト、バナーサイズ、生成枚数を設定して「バナーを生成する」を押すとAIが自動生成します。',
                  targetSelector: '[data-tour="generation-form"]',
                  allowMissing: true,
                },
                {
                  id: 'pricing-plans',
                  label: 'プランをアップグレード',
                  description:
                    '無料は1日3枚まで。有料プラン（PRO / Enterprise）なら最大500枚/日まで生成できます。',
                  targetSelector: '[data-tour="pricing-plans"]',
                  allowMissing: true,
                },
              ]
            : []),
          {
            id: 'intro',
            label: 'サイドバーから機能を選ぶ',
            description: '左のサイドバーから、使いたい機能にすぐ移動できます。順番に確認してみましょう。',
            targetSelector: '[data-tour-nav]',
          },
          ...activeNavItems.map((it) => ({
            id: it.href,
            label: it.label,
            description:
              it.href === '/banner/dashboard'
                ? 'テンプレートギャラリーからスタイルを選んでバナーを生成します。'
                : it.href === '/banner/dashboard/create'
                  ? 'テンプレートを使わず、ゼロからバナーを自由に作成できます。'
                  : it.href === '/banner/dashboard/plan'
                    ? '現在のプランの確認やアップグレードができます。'
                    : it.href.startsWith('/banner')
                      ? 'この機能でバナー制作を進めます。'
                      : 'この機能でSEO制作を進めます。クリックして画面を確認してみてください。',
            targetSelector: `[data-tour-nav="${it.href.split('#')[0]}"]`,
          })),
        ]}
      />

      {/* スマホ専用：シンプルなスライド形式の使い方紹介 */}
      {isBanner && (
        <MobileTourPopup
          storageKey={`doya_mobile_tour_banner_${String((session?.user as any)?.id || 'guest')}`}
          autoStart={true}
          slides={BANNER_TOUR_SLIDES}
        />
      )}

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={dashboardTheme}
      />
    </>
  )
}

export default memo(DashboardSidebarImpl)
