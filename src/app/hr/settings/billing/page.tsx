'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

interface BillingInfo {
  plan: string
  planLabel: string
  employeeCount: number
  employeeLimit: number
  memberCount: number
  memberLimit: number
  aiUsageCount: number
  aiUsageLimit: number
}

// 現在プラン表示用の最小定義（プラン一覧UIは UnifiedPricingPlans に統一）
const PLAN_DISPLAY: Record<string, { name: string; color: string }> = {
  free: { name: 'Free', color: 'from-slate-400 to-slate-500' },
  pro: { name: 'Pro', color: 'from-purple-500 to-purple-600' },
  enterprise: { name: 'Enterprise', color: 'from-amber-500 to-orange-500' },
}

function UsageBar({ label, used, limit, icon, color }: {
  label: string
  used: number
  limit: number
  icon: string
  color: string
}) {
  const pct = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const isWarning = pct >= 80
  const isCritical = pct >= 95

  return (
    <div className="p-4 rounded-2xl bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
          <span className="text-sm font-bold text-slate-700">{label}</span>
        </div>
        <span className={`text-sm font-black ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-600'}`}>
          {used} / {limit >= 999 ? '∞' : limit}
        </span>
      </div>
      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isCritical
              ? 'bg-gradient-to-r from-red-500 to-red-600'
              : isWarning
              ? 'bg-gradient-to-r from-amber-400 to-amber-500'
              : 'bg-gradient-to-r from-blue-500 to-emerald-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      {isWarning && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-xs font-bold mt-1.5 ${isCritical ? 'text-red-500' : 'text-amber-500'}`}
        >
          <span className="material-symbols-outlined text-xs align-middle mr-0.5">warning</span>
          {isCritical ? '上限に近づいています! アップグレードを検討してください' : '使用量が80%を超えています'}
        </motion.p>
      )}
    </div>
  )
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch('/api/hr/usage')
        if (res.ok) {
          const data = await res.json()
          setBilling(data)
        } else {
          setBilling({
            plan: 'free',
            planLabel: 'Free',
            employeeCount: 0,
            employeeLimit: 5,
            memberCount: 0,
            memberLimit: 2,
            aiUsageCount: 0,
            aiUsageLimit: 3,
          })
        }
      } catch {
        setBilling({
          plan: 'free',
          planLabel: 'Free',
          employeeCount: 0,
          employeeLimit: 5,
          memberCount: 0,
          memberLimit: 2,
          aiUsageCount: 0,
          aiUsageLimit: 3,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchBilling()
  }, [])

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/hr/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'ポータルセッションの作成に失敗しました')
      }
    } catch {
      alert('エラーが発生しました。もう一度お試しください。')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-40 bg-slate-200 rounded" />
          <div className="h-48 bg-slate-100 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-slate-100 rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const planKey = String(billing?.plan || 'free').toLowerCase()
  const currentPlan = PLAN_DISPLAY[planKey] || PLAN_DISPLAY.free
  const isPaid = planKey !== 'free'

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/hr/settings"
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                設定
              </Link>
              <span className="material-symbols-outlined text-sm text-slate-400">chevron_right</span>
              <span className="text-sm font-bold text-slate-700">現在のプラン</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900">現在のプラン</h1>
            <p className="text-sm text-slate-500 mt-1">プランと使用量を管理</p>
          </div>
          <motion.img
            src="/hr/characters/present_プレゼン.png"
            alt="白くまキャラクター"
            className="w-16 drop-shadow-md"
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />
        </div>

        {/* Current Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`bg-gradient-to-r ${currentPlan.color} rounded-3xl shadow-lg p-6 mb-8 text-white relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">workspace_premium</span>
              </div>
              <div>
                <p className="text-sm font-bold opacity-80">現在のプラン</p>
                <h2 className="text-2xl font-black">{currentPlan.name}</h2>
              </div>
            </div>
            {isPaid && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePortal}
                disabled={portalLoading}
                className="mt-3 px-5 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm font-bold transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm align-middle mr-1">settings</span>
                {portalLoading ? '読み込み中...' : '契約を管理'}
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-md p-6 mb-8"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600">monitoring</span>
            </div>
            使用状況
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UsageBar
              label="従業員数"
              used={billing?.employeeCount ?? 0}
              limit={billing?.employeeLimit ?? 5}
              icon="people"
              color="text-blue-600"
            />
            <UsageBar
              label="メンバー数"
              used={billing?.memberCount ?? 0}
              limit={billing?.memberLimit ?? 2}
              icon="group"
              color="text-purple-600"
            />
            <UsageBar
              label="AI利用 (今月)"
              used={billing?.aiUsageCount ?? 0}
              limit={billing?.aiUsageLimit ?? 3}
              icon="smart_toy"
              color="text-teal-600"
            />
          </div>
        </motion.div>

        {/* Plans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-600">rocket_launch</span>
            </div>
            プラン一覧
          </h2>
          {/* 全サービス共通の 無料 / プロ(¥9,980) 2プラン */}
          <UnifiedPricingPlans serviceId="hr" currentPlan={billing?.plan} />
        </motion.div>

        {/* Help */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-white rounded-3xl shadow-md p-6 flex items-center gap-4"
        >
          <img
            src="/hr/characters/point_解説.png"
            alt="白くまキャラクター"
            className="w-16 flex-shrink-0"
          />
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">プラン選びに迷ったら</h3>
            <p className="text-sm text-slate-500">
              従業員数や必要な機能に応じて最適なプランをご案内します。お気軽にお問い合わせください。
            </p>
          </div>
          <button
            onClick={() => window.open('mailto:info@surisuta.jp?subject=ドヤHR プランのご相談', '_blank')}
            className="flex-shrink-0 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-full text-sm font-bold hover:bg-slate-200 transition-all"
          >
            <span className="material-symbols-outlined text-sm align-middle mr-1">mail</span>
            相談する
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
