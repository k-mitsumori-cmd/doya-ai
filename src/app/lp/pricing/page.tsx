'use client'

import { useSession } from 'next-auth/react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function LpPricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.lpPlan || user?.plan || 'FREE').toUpperCase()

  return (
    <div className="min-h-screen bg-lp-bg text-white relative">
      {/* 背景グラデーションオーブ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-lp-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-lp-primary/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">料金プラン</h1>
          <p className="text-slate-400">AIでLPを自動生成。あなたに合ったプランをお選びください。</p>
        </div>

        <UnifiedPricingPlans serviceId="lp" currentPlan={currentPlan} className="my-12" />

        {/* CTA Footer */}
        <div className="bg-lp-primary/5 border border-lp-primary/10 rounded-xl p-8 text-center max-w-4xl mx-auto mt-12">
          <p className="text-white font-bold mb-2">ご不明な点はお気軽にどうぞ</p>
          <p className="text-sm text-slate-500 mb-4">プランの詳細やカスタム対応についてご相談ください。</p>
          <a
            href="mailto:info@surisuta.jp"
            className="inline-flex items-center gap-2 bg-lp-primary/20 hover:bg-lp-primary/30 text-lp-primary px-6 py-3 rounded-lg font-bold transition-all text-sm"
          >
            メールで相談する
          </a>
        </div>
      </div>
    </div>
  )
}
