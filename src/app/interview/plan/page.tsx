'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Crown, Zap, CheckCircle2, X, AlertCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { CheckoutButton } from '@/components/CheckoutButton'

type Plan = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE'

interface PlanInfo {
  id: Plan
  name: string
  description: string
  maxAudioSize: string
  maxVideoSize: string
  features: string[]
  price: number
  color: string
  gradient: string
}

const PLANS: PlanInfo[] = [
  {
    id: 'GUEST',
    name: 'ゲスト',
    description: '最初の1時間は使い放題（エンタープライズ機能まで）',
    maxAudioSize: '100MB',
    maxVideoSize: '不可',
    features: [
      '最初の1時間は使い放題',
      '音声ファイルのみ（最大100MB）',
      '動画ファイルは不可',
    ],
    price: 0,
    color: 'gray',
    gradient: 'from-gray-500 to-gray-600',
  },
  {
    id: 'FREE',
    name: '無料',
    description: '音声ファイルのみアップロード可能',
    maxAudioSize: '1GB',
    maxVideoSize: '不可',
    features: [
      '音声ファイルのみ（最大1GB）',
      '動画ファイルは不可',
    ],
    price: 0,
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    id: 'PRO',
    name: 'PRO',
    description: '動画ファイルもアップロード可能',
    maxAudioSize: '5GB',
    maxVideoSize: '5GB',
    features: [
      '動画ファイルもアップロード可能（最大5GB）',
      '音声ファイル（最大5GB）',
    ],
    price: 4980,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: '大容量動画ファイルもアップロード可能',
    maxAudioSize: '10GB',
    maxVideoSize: '10GB',
    features: [
      '大容量動画ファイルもアップロード可能（最大10GB）',
      '音声ファイル（最大10GB）',
    ],
    price: 49800,
    color: 'indigo',
    gradient: 'from-indigo-500 to-blue-600',
  },
]

export default function InterviewPlanPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const [currentPlan, setCurrentPlan] = useState<Plan>('GUEST')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 現在のプランを取得
    const fetchCurrentPlan = async () => {
      try {
        const res = await fetch('/api/interview/plan/current')
        if (res.ok) {
          const data = await res.json()
          setCurrentPlan(data.plan || 'GUEST')
        }
      } catch (error) {
        console.error('Failed to fetch current plan:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentPlan()
  }, [])

  const handleDowngrade = async (targetPlan: Plan) => {
    if (!confirm(`本当に${PLANS.find(p => p.id === targetPlan)?.name}プランに変更しますか？`)) {
      return
    }

    try {
      const res = await fetch('/api/interview/plan/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlan }),
      })

      if (res.ok) {
        const data = await res.json()
        setCurrentPlan(data.plan)
        alert('プランを変更しました')
      } else {
        const error = await res.json()
        alert(`エラー: ${error.error || 'プランの変更に失敗しました'}`)
      }
    } catch (error) {
      console.error('Failed to downgrade plan:', error)
      alert('プランの変更に失敗しました')
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
        <div className="text-center py-12">
          <p className="text-gray-500 font-bold">読み込み中...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/interview/settings"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-xs sm:text-sm mb-2 font-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            設定に戻る
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">料金プラン</h1>
          <p className="text-sm text-gray-500 mt-1">プランの確認・変更・アップグレードができます。</p>
        </div>
      </div>

      {/* 現在のプラン表示 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl sm:rounded-[32px] border-2 border-orange-200 shadow-xl shadow-orange-500/10 p-6 sm:p-8 mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">現在のプラン</h2>
            <p className="text-sm text-gray-600">
              {PLANS.find(p => p.id === currentPlan)?.name || 'ゲスト'}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {PLANS.find(p => p.id === currentPlan)?.description || ''}
        </p>
      </motion.div>

      {/* プラン一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {PLANS.map((plan, idx) => {
          const isCurrentPlan = plan.id === currentPlan
          const isHigherPlan = ['PRO', 'ENTERPRISE'].includes(plan.id) && !['PRO', 'ENTERPRISE'].includes(currentPlan)
          const isLowerPlan = plan.id === 'FREE' && ['PRO', 'ENTERPRISE'].includes(currentPlan)

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white rounded-2xl border-2 ${
                isCurrentPlan
                  ? 'border-orange-300 shadow-xl shadow-orange-500/10'
                  : 'border-gray-200 shadow-lg'
              } overflow-hidden`}
            >
              {/* ヘッダー */}
              <div className={`bg-gradient-to-r ${plan.gradient} p-6 text-white`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-black">{plan.name}</h3>
                  {isCurrentPlan && (
                    <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black">
                      現在のプラン
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/90">{plan.description}</p>
                {plan.price > 0 && (
                  <div className="mt-4">
                    <span className="text-3xl font-black">¥{plan.price.toLocaleString()}</span>
                    <span className="text-sm text-white/80">/月</span>
                  </div>
                )}
              </div>

              {/* コンテンツ */}
              <div className="p-6">
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 font-bold">音声ファイル</span>
                    <span className="text-gray-900 font-black">{plan.maxAudioSize}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 font-bold">動画ファイル</span>
                    <span className="text-gray-900 font-black">{plan.maxVideoSize}</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, featureIdx) => (
                    <li key={featureIdx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* アクションボタン */}
                <div className="space-y-2">
                  {isCurrentPlan ? (
                    <div className="p-3 rounded-xl bg-gray-50 text-center text-sm font-black text-gray-600">
                      現在のプランです
                    </div>
                  ) : isHigherPlan ? (
                    <CheckoutButton
                      planId={`interview-${plan.id.toLowerCase()}`}
                      billingPeriod="monthly"
                      className="w-full"
                    >
                      {plan.name}プランにアップグレード
                    </CheckoutButton>
                  ) : isLowerPlan ? (
                    <button
                      onClick={() => handleDowngrade(plan.id)}
                      className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-black text-sm hover:bg-gray-200 transition-colors"
                    >
                      {plan.name}プランに変更
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-gray-50 text-center text-sm font-bold text-gray-500">
                      利用可能
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 注意事項 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-black text-yellow-900 mb-2">プラン変更について</h3>
            <ul className="text-xs text-yellow-800 space-y-1">
              <li>• プランのアップグレードは即座に反映されます</li>
              <li>• プランのダウングレードは次回の請求サイクルから適用されます</li>
              <li>• ゲストユーザーは最初の1時間、エンタープライズ機能まで使い放題です</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </main>
  )
}

