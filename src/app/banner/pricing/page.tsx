'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

export default function BannerPricingPage() {
  const { data: session } = useSession()
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

        <div className="space-y-6">
          {/* おためし */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{free?.name || 'おためしプラン'}</h2>
                <p className="text-sm text-slate-600 mt-2">{free?.description || `1日${BANNER_PRICING.freeLimit}回までの生成をすることができます`}</p>
                <div className="mt-5">
                  <Link href="/banner">
                    <button className="px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors">
                      {free?.cta || '3回生成'}
                    </button>
                  </Link>
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
                <p className="text-sm text-slate-600 mt-2">{pro?.description || '1日50枚まで生成（PRO）'}</p>
                <div className="mt-5">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    1日50枚まで生成可能
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
              <CheckoutButton
                planId="banner-pro"
                loginCallbackUrl="/banner/pricing"
                className="w-full py-4 rounded-2xl text-base"
                variant="primary"
              >
                プロプランを始める
              </CheckoutButton>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{enterprise?.name || 'エンタープライズ'}</h2>
                <p className="text-sm text-slate-600 mt-2">{enterprise?.description || '1日500枚まで生成（Enterprise）'}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    1日500枚まで生成可能
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    大量生成・チーム運用向け
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
              <CheckoutButton planId="banner-enterprise" loginCallbackUrl="/banner/pricing" className="w-full py-4 rounded-2xl text-base">
                エンタープライズを始める
              </CheckoutButton>
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
          <Link href="/banner">
            <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
              おためしプランを使ってみる
            </button>
          </Link>
        </div>
      </main>
    </div>
  )
}
