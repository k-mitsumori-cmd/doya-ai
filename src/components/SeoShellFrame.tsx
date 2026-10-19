'use client'

// ドヤライティングAI 共通の枠の中身（ToolFrame だけ。AppShell では包まない）
// 今の SeoAppLayout が出していた「初回ログイン特典の残り時間」「現在のプラン」「新規記事作成」を、枠の中でも同じ値で出す。
// ⚠️ 本文の余白と最大幅は SeoAppLayout と同じにする（/seo/template の負の margin がこの余白を打ち消す前提のため）
import React from 'react'
import Link from 'next/link'
import { Plus, Timer } from 'lucide-react'
import ToolFrame from '@/components/shell/ToolFrame'
import { SEO_NAV, seoNavHref } from '@/lib/seo/nav'
import { getFreeHourRemainingMs, isWithinFreeHour } from '@/lib/pricing'

type SeoPlanCode = 'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'

const PLAN_LABEL: Record<SeoPlanCode, string> = {
  PRO: 'プロ',
  ENTERPRISE: 'エンタープライズ',
  LIGHT: 'ライト',
  GUEST: 'ゲスト',
  FREE: '無料',
  UNKNOWN: '不明',
}

export default function SeoShellFrame({
  children,
  currentPlan,
  isLoggedIn,
  firstLoginAt,
}: {
  children: React.ReactNode
  currentPlan?: SeoPlanCode
  isLoggedIn?: boolean
  firstLoginAt?: string | null
}) {
  const [trialRemainSec, setTrialRemainSec] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isLoggedIn || !isWithinFreeHour(firstLoginAt)) {
      setTrialRemainSec(null)
      return
    }
    const tick = () => {
      const remain = Math.floor(getFreeHourRemainingMs(firstLoginAt) / 1000)
      setTrialRemainSec(remain > 0 ? remain : null)
    }
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [isLoggedIn, firstLoginAt])

  const nav = SEO_NAV.map((item) => ({ ...item, href: seoNavHref(item.href, !!isLoggedIn) }))

  return (
    <ToolFrame
      serviceId="seo"
      title="ドヤライティングAI"
      description="SEOツール"
      nav={nav}
      action={
        <div className="flex items-center gap-2">
          <Link
            href={seoNavHref('/seo/pricing', !!isLoggedIn)}
            className="hidden sm:inline-flex h-10 px-4 items-center rounded-xl border border-gray-200 bg-gray-50 text-xs font-black text-gray-600"
          >
            現在のプラン：{PLAN_LABEL[currentPlan ?? 'UNKNOWN']}
          </Link>
          <Link
            href="/seo/create"
            className="h-10 px-3 sm:px-4 rounded-xl bg-[#2563EB] text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 sm:gap-2"
            title="新規記事作成"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">新規記事作成</span>
          </Link>
        </div>
      }
    >
      {trialRemainSec != null && (
        <div className="px-4 md:px-8 pt-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <Timer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-blue-900 truncate">初回ログイン特典：1時間 使い放題（PRO相当）</p>
                <p className="text-[10px] font-bold text-blue-800/80 truncate">画像生成・AI自動修正などが解放されています</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="text-right">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">残り</p>
                <p className="text-sm font-black text-blue-900 tabular-nums">
                  {Math.floor(trialRemainSec / 60)}:{String(trialRemainSec % 60).padStart(2, '0')}
                </p>
              </div>
              <div className="flex-1 sm:flex-none sm:w-28 h-2 rounded-full bg-blue-100 overflow-hidden">
                <div className="h-2 bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, (trialRemainSec / 3600) * 100))}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </div>
    </ToolFrame>
  )
}
