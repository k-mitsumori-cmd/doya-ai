'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function KintaiPricingPage() {
  const [userPlan, setUserPlan] = useState<string>('FREE')
  useEffect(() => {
    fetch('/api/kintai/usage').then(r => r.json()).then(d => setUserPlan(d.plan || 'FREE')).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">

      <div className="p-6 lg:p-10 max-w-6xl mx-auto relative">
        {/* Floating bears */}
        <img
          src="/kintai/characters/thumbsup_いいね.png"
          alt=""
          className="bear-float hidden lg:block absolute -left-4 top-40 opacity-40"
          style={{ width: 80, height: 80, objectFit: 'contain' }}
        />
        <img
          src="/kintai/characters/jump_大喜び.png"
          alt=""
          className="bear-float-2 hidden lg:block absolute -right-4 top-96 opacity-40"
          style={{ width: 70, height: 70, objectFit: 'contain' }}
        />

        {/* Header */}
        <div className="text-center mb-12 pricing-fade-in">
          <img
            src="/kintai/characters/present_プレゼン.png"
            alt="プレゼンするクマ"
            className="bear-float mx-auto mb-4"
            style={{ width: 120, height: 120, objectFit: 'contain' }}
          />
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 mb-3">
            ドヤ勤怠 料金プラン
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto text-base">
            チームの成長に合わせて最適なプランを選択できます。
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-gradient-to-r from-[#7f19e6]/10 to-violet-100 rounded-full">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              celebration
            </span>
            <span className="text-sm font-bold text-[#7f19e6]">
              従業員5名まで永久無料
            </span>
          </div>
        </div>

        {/* Plans grid (統一プラン: 無料 / プロ¥9,980) */}
        <UnifiedPricingPlans serviceId="kintai" currentPlan={userPlan} className="my-12" />

        {/* Trial notice */}
        <div className="text-center mb-8">
          <p className="text-sm text-slate-500">
            <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
            全プラン14日間の無料トライアル付き（クレジットカード不要）
          </p>
        </div>

        {/* CTA section */}
        <div className="bg-white rounded-3xl shadow-lg p-8 text-center pricing-fade-in-4">
          <img
            src="/kintai/characters/hello_挨拶.png"
            alt="挨拶するクマ"
            className="bear-float-2 mx-auto mb-4"
            style={{ width: 100, height: 100, objectFit: 'contain' }}
          />
          <h3 className="text-xl font-black text-slate-900 mb-2">まずは無料で始めてみませんか？</h3>
          <p className="text-base text-slate-600 mb-6 max-w-lg mx-auto">
            クレジットカード不要、従業員5名までの勤怠管理が永久無料でお使いいただけます。
            アップグレードはいつでも可能です。
          </p>
          <Link
            href="/kintai/dashboard"
            className="inline-flex items-center gap-2 px-10 py-4 bg-[#7f19e6] text-white rounded-full text-base font-bold shadow-lg shadow-[#7f19e6]/25 hover:shadow-xl hover:bg-[#6b14c4] transition-all"
          >
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            無料で始める
          </Link>
        </div>
      </div>
    </div>
  )
}
