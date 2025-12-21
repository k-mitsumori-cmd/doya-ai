'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

export default function BannerPricingPage() {
  const { data: session } = useSession()
  const plans = BANNER_PRICING.plans
  const free = plans.find((p) => p.id === 'banner-free')
  const basic = plans.find((p) => p.id === 'banner-basic')
  const enterprise = plans.find((p) => p.id === 'banner-enterprise')

  return (
    <div className="min-h-screen bg-white">
      {/* Small top link (like screenshot) */}
      <div className="pt-6 flex justify-center">
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
                  <Link href="/banner/dashboard">
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
                <h2 className="text-2xl font-black text-slate-900">{basic?.name || 'Basicプラン'}</h2>
                <p className="text-sm text-slate-600 mt-2">{basic?.description || '個人事業主におすすめのプラン'}</p>
                <div className="mt-5">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    1日30回までの生成が可能
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-slate-900 text-white font-black text-xl">
                  {basic?.priceLabel || '月額 ¥3,980'}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <CheckoutButton
                planId="banner-basic"
                className="w-full py-4 rounded-2xl text-base"
                variant="secondary"
              >
                Basicプランを始める
              </CheckoutButton>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{enterprise?.name || 'Enterpriseプラン'}</h2>
                <p className="text-sm text-slate-600 mt-2">{enterprise?.description || 'スタートアップや中小企業におすすめ'}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    すべての機能
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-black text-sm">
                    ＋ まるなげマーケティング支援
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <a
                  href={HIGH_USAGE_CONTACT_URL}
                  target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
                  rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
                  className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xl hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
                >
                  お問い合わせ
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 flex justify-center">
          <Link href="/banner/dashboard">
            <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
              おためしプランを使ってみる
            </button>
          </Link>
        </div>
      </main>
    </div>
  )
}
