'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import BannerCancelScheduleNotice from '@/components/BannerCancelScheduleNotice'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { higherPlan } from '@/lib/plan-utils'

export default function BannerPricingPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const bannerPlanTier = isLoggedIn
    ? higherPlan((session?.user as any)?.bannerPlan, (session?.user as any)?.plan)
    : 'GUEST'
  const isPaid = bannerPlanTier === 'LIGHT' || bannerPlanTier === 'PRO' || bannerPlanTier === 'ENTERPRISE'

  return (
    <div className="min-h-screen bg-white">
      {/* Small top link (like screenshot) */}
      <div className="pt-6 flex items-center justify-center gap-3">
        <Link
          href="/banner"
          className="text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-2 rounded-full"
        >
          ドヤバナーAIに戻る
        </Link>
        <Link href="/banner/dashboard/plan" className="text-xs font-bold text-blue-600 hover:text-blue-700">
          Plan
        </Link>
      </div>

      <main className="max-w-[720px] mx-auto px-6 pb-12">
        <h1 className="text-center text-3xl sm:text-4xl font-black text-slate-900 mt-6 mb-10">
          料金プラン
        </h1>
        <p className="mb-6 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          バナー画像の月間枚数とは別に、AI相談とコピー提案は共通の日次枠を使います。無料プランは1日10回、PROは100回です。既存のLIGHT契約は30回、個別契約のEnterprise相当は1,000回です。日本時間の翌日にリセットされます。
        </p>

        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-sm font-black text-slate-800">
            現在のプラン：{bannerPlanTier === 'GUEST' ? 'ゲスト' : bannerPlanTier === 'FREE' ? '無料' : bannerPlanTier === 'LIGHT' ? 'ライト' : bannerPlanTier === 'PRO' ? 'PRO' : 'Enterprise'}
          </p>
          {/* 解約予約中（次回更新日で停止）の場合は停止日時を表示 */}
          <div className="w-full">
            <BannerCancelScheduleNotice className="max-w-[720px] mx-auto" />
          </div>
          {isPaid && (
            <Link
              href="/banner/dashboard/plan"
              className="text-xs font-black text-blue-600 hover:text-blue-800"
            >
              アカウント画面でプラン変更/解約を行う →
            </Link>
          )}
        </div>

        <UnifiedPricingPlans serviceId="banner" currentPlan={bannerPlanTier} className="my-12" />

        {/* Bottom CTA */}
        <div className="mt-10 flex justify-center">
          {isLoggedIn ? (
            <Link href="/banner/dashboard/plan">
              <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                アカウント画面でプランを管理する
              </button>
            </Link>
          ) : (
            <Link href="/banner">
              <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                おためしプランを使ってみる
              </button>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
