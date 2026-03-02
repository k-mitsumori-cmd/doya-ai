'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import BannerCancelScheduleNotice from '@/components/BannerCancelScheduleNotice'

export default function BannerPricingPage() {
  const { data: session } = useSession()
  const bannerPlanRaw = String((session?.user as any)?.bannerPlan || (session?.user as any)?.plan || (session ? 'FREE' : 'GUEST')).toUpperCase()
  const bannerPlanTier = (() => {
    const p = String(bannerPlanRaw || '').toUpperCase()
    if (!p || p === 'GUEST') return 'GUEST' as const
    if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
    if (p.includes('PRO') || p.includes('BASIC') || p.includes('STARTER') || p.includes('BUSINESS')) return 'PRO' as const
    if (p.includes('FREE')) return 'FREE' as const
    return 'FREE' as const
  })()
  const isLoggedIn = !!session?.user?.email
  const isPaid = bannerPlanTier === 'PRO' || bannerPlanTier === 'ENTERPRISE'

  const plans = BANNER_PRICING.plans
  const free = plans.find((p) => p.id === 'banner-free')
  const pro = plans.find((p) => p.id === 'banner-pro')
  const enterprise = plans.find((p) => p.id === 'banner-enterprise')

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

        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-sm font-black text-slate-800">
            現在のプラン：{bannerPlanTier === 'GUEST' ? 'ゲスト' : bannerPlanTier === 'FREE' ? '無料' : bannerPlanTier === 'PRO' ? 'PRO' : 'Enterprise'}
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

        <div className="space-y-6">
          {/* おためし */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{free?.name || 'おためしプラン'}</h2>
                <p className="text-sm text-slate-600 mt-2">{free?.description || `月${BANNER_PRICING.freeLimit}枚までの生成をすることができます`}</p>
                <div className="mt-5">
                  {bannerPlanTier === 'FREE' ? (
                    <button
                      disabled
                      className="px-4 py-2 rounded-full bg-slate-200 text-slate-600 font-black text-sm cursor-not-allowed"
                    >
                      現在のプラン
                    </button>
                  ) : (
                    <Link href="/banner">
                      <button className="px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors">
                        {free?.cta || '3回生成'}
                      </button>
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-2xl">
                  {free?.priceLabel || '無料'}
                </div>
              </div>
            </div>
          </div>

          {/* Basic */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{pro?.name || 'プロプラン'}</h2>
                <p className="text-sm text-slate-600 mt-2">{pro?.description || '1日30枚まで生成（PRO）'}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    1日30枚まで生成
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    サイズ自由指定
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    同時生成: 最大5枚
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-slate-900 text-white font-black text-xl">
                  {pro?.priceLabel || '月額 ¥9,980'}
                </div>
              </div>
            </div>
            <div className="mt-6">
              {bannerPlanTier === 'PRO' ? (
                <button
                  disabled
                  className="w-full py-4 rounded-2xl text-base font-black bg-slate-200 text-slate-600 cursor-not-allowed"
                >
                  現在のプラン
                </button>
              ) : bannerPlanTier === 'ENTERPRISE' ? (
                <button
                  disabled
                  className="w-full py-4 rounded-2xl text-base font-black bg-slate-200 text-slate-600 cursor-not-allowed"
                >
                  プランダウングレード
                </button>
              ) : (
                <CheckoutButton
                  planId="banner-pro"
                  loginCallbackUrl="/banner/pricing"
                  className="w-full py-4 rounded-2xl text-base"
                  variant="primary"
                >
                  プロプランを始める
                </CheckoutButton>
              )}
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{enterprise?.name || 'エンタープライズ'}</h2>
                <p className="text-sm text-slate-600 mt-2">{enterprise?.description || '1日200枚まで生成（Enterprise）'}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    1日200枚まで生成
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    大量運用・チーム向け
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    優先サポート
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    さらに上限UP相談可
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xl">
                  {enterprise?.priceLabel || '月額 ¥49,800'}
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {bannerPlanTier === 'ENTERPRISE' ? (
                <button
                  disabled
                  className="w-full py-4 rounded-2xl text-base font-black bg-slate-200 text-slate-600 cursor-not-allowed"
                >
                  現在のプラン
                </button>
              ) : (
                <CheckoutButton planId="banner-enterprise" loginCallbackUrl="/banner/pricing" className="w-full py-4 rounded-2xl text-base">
                  {bannerPlanTier === 'PRO' ? 'エンタープライズにアップグレード' : 'エンタープライズを始める'}
                </CheckoutButton>
              )}
              <a
                href={HIGH_USAGE_CONTACT_URL}
                target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
                rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
                className="w-full py-3 rounded-2xl bg-white text-slate-900 font-black text-sm hover:bg-slate-50 transition-colors inline-flex items-center justify-center border border-slate-200"
              >
                さらに上限UPの相談（マーケティング施策を丸投げする）
              </a>
            </div>
          </div>
        </div>

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
