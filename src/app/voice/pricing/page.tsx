'use client'

import { useSession } from 'next-auth/react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function VoicePricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.voicePlan || user?.plan || 'FREE').toUpperCase()

  return (
    <div className="flex flex-col max-w-[1200px] w-full mx-auto px-6 md:px-10 py-12 md:py-20">
      {/* ===== Page Title ===== */}
      <div className="flex flex-col gap-4 text-center mb-16">
        <h1 className="text-slate-900 text-4xl md:text-5xl font-black leading-tight tracking-tight">
          料金プラン
        </h1>
        <p className="text-slate-600 text-lg">
          用途に合わせて最適なプランをお選びください
        </p>
      </div>

      <UnifiedPricingPlans serviceId="voice" currentPlan={currentPlan} className="my-12" />

      {/* ===== Bottom Banner ===== */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 text-center mt-16">
        <p className="text-sm font-bold text-primary">
          Proプランに契約すると、ドヤボイスAIだけでなく全サービス（ドヤバナーAI・ドヤ記事作成・ドヤインタビュー等）のPro機能が同時に解放されます。
        </p>
      </div>
    </div>
  )
}
