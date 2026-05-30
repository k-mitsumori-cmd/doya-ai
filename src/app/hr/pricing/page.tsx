'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function HrPricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-10">
            <Link
              href="/hr/dashboard"
              className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              ダッシュボードに戻る
            </Link>
            <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
            <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
              ドヤHR は5名まで永久無料。プロプラン1つで、ドヤAIの全サービスのプロ機能が使い放題になります。
            </p>
          </div>

          {/* 全サービス共通の 無料 / プロ(¥9,980) 2プラン */}
          <UnifiedPricingPlans serviceId="hr" />
        </motion.div>
      </div>
    </div>
  )
}
