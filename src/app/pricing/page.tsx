'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

function PricingContent() {
  const searchParams = useSearchParams()
  const canceled = searchParams.get('canceled') || searchParams.get('payment') === 'cancelled'
  const success = searchParams.get('success')

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-4">料金プラン</h1>
          <p className="text-lg text-slate-600">
            プロプラン1つで、ドヤAIの全サービスのプロ機能が使い放題になります。
          </p>
        </div>

        {canceled && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-center">
            決済がキャンセルされました。もう一度お試しください。
          </div>
        )}

        {success && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-center">
            🎉 ご登録ありがとうございます！プランが有効になりました。
          </div>
        )}

        {/* 全サービス共通の 無料 / プロ(¥9,980) 2プラン */}
        <UnifiedPricingPlans serviceId="banner" />

        <div className="mt-12 text-center">
          <Link href="/banner" className="text-slate-500 hover:text-slate-700">
            ← ドヤバナーAIに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
      <PricingContent />
    </Suspense>
  )
}
