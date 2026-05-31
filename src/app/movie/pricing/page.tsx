'use client'
// ============================================
// ドヤムービーAI - 料金プラン
// ============================================
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function MoviePricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.moviePlan || user?.plan || 'FREE').toUpperCase()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-white mb-3">料金プラン</h1>
        <p className="text-rose-300">月3本まで無料。本格的な動画制作はProプランで。</p>
      </div>

      <UnifiedPricingPlans serviceId="movie" currentPlan={currentPlan} className="my-12" />

      {/* FAQ */}
      <div className="max-w-2xl mx-auto text-center mt-12">
        <p className="text-rose-300 text-sm mb-4">
          ご不明な点は{' '}
          <Link href="/movie/guide" className="text-rose-400 hover:text-rose-300 underline">
            使い方ガイド
          </Link>
          をご確認ください。
        </p>
      </div>
    </div>
  )
}
