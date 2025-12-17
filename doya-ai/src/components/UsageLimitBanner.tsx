'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Zap,
  Crown,
  ArrowRight,
  X,
  Sparkles,
  LogIn,
  UserPlus,
} from 'lucide-react'
import { getUsageCount, getRemainingCount, PLAN_LIMITS, UserTier } from '@/lib/usage'

export function UsageLimitBanner() {
  const { data: session, status } = useSession()
  const [remaining, setRemaining] = useState<number | 'unlimited'>(3)
  const [dismissed, setDismissed] = useState(false)

  // ユーザーのティアを判定
  const getUserTier = (): UserTier => {
    if (!session) return 'guest'
    const plan = (session.user as any)?.plan
    if (plan === 'ENTERPRISE') return 'enterprise'
    if (plan === 'BUSINESS') return 'business'
    if (plan === 'PREMIUM') return 'premium'
    return 'free'
  }

  const tier = getUserTier()
  const limits = PLAN_LIMITS[tier]

  useEffect(() => {
    setRemaining(getRemainingCount(tier))
  }, [tier])

  // 無制限または十分な残り回数がある場合は表示しない
  if (remaining === 'unlimited' || (typeof remaining === 'number' && remaining > 5)) {
    return null
  }

  if (dismissed) return null

  // ゲストユーザーの場合
  if (tier === 'guest') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-4 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900">
                残り<span className="font-bold text-lg mx-1">{remaining}</span>回のお試しが可能です
              </p>
              <p className="text-xs text-amber-700">
                無料登録で1日10回まで利用可能に！
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              無料で登録
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-amber-400 hover:text-amber-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // 無料ユーザーで残り少ない場合
  if (tier === 'free' && typeof remaining === 'number' && remaining <= 5) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 px-4 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-900">
                本日の残り<span className="font-bold text-lg mx-1">{remaining}</span>回
              </p>
              <p className="text-xs text-purple-700">
                プレミアムで1日100回まで使い放題！
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity"
            >
              <Crown className="w-4 h-4" />
              アップグレード
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-purple-400 hover:text-purple-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return null
}

// 使用制限に達した時のモーダル
export function UsageLimitModal({
  isOpen,
  onClose,
  tier,
}: {
  isOpen: boolean
  onClose: () => void
  tier: UserTier
}) {
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            本日の使用回数に達しました
          </h2>
          <p className="text-gray-600">
            {tier === 'guest'
              ? '無料登録で1日10回まで利用できます！'
              : 'プレミアムプランで使用回数を増やしましょう！'}
          </p>
        </div>

        {tier === 'guest' ? (
          <div className="space-y-3">
            <Link
              href="/auth/signin"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              <UserPlus className="w-5 h-5" />
              無料で登録する（1日10回）
            </Link>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
            >
              明日また試す
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href="/pricing"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              <Crown className="w-5 h-5" />
              プレミアムにアップグレード
            </Link>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
            >
              明日また使う
            </button>
          </div>
        )}

        {/* プラン比較 */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center mb-3">プラン比較</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className={`p-2 rounded-lg ${tier === 'guest' ? 'bg-gray-100' : 'bg-gray-50'}`}>
              <p className="font-medium text-gray-700">ゲスト</p>
              <p className="text-gray-500">3回/日</p>
            </div>
            <div className={`p-2 rounded-lg ${tier === 'free' ? 'bg-primary-100' : 'bg-gray-50'}`}>
              <p className="font-medium text-gray-700">無料登録</p>
              <p className="text-gray-500">10回/日</p>
            </div>
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
              <p className="font-medium text-amber-700">プレミアム</p>
              <p className="text-amber-600">100回/日</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// 使用回数表示コンポーネント（サイドバー用）
export function UsageIndicator() {
  const { data: session } = useSession()
  const [usage, setUsage] = useState(0)
  const [mounted, setMounted] = useState(false)

  const getUserTier = (): UserTier => {
    if (!session) return 'guest'
    const plan = (session.user as any)?.plan
    if (plan === 'ENTERPRISE') return 'enterprise'
    if (plan === 'BUSINESS') return 'business'
    if (plan === 'PREMIUM') return 'premium'
    return 'free'
  }

  const tier = getUserTier()
  const limits = PLAN_LIMITS[tier]
  const remaining = getRemainingCount(tier)

  useEffect(() => {
    setMounted(true)
    setUsage(getUsageCount())
  }, [])

  if (!mounted) return null

  if (remaining === 'unlimited') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>無制限</span>
      </div>
    )
  }

  const percentage = limits.daily > 0 ? (usage / limits.daily) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">本日の残り</span>
        <span className="font-medium text-gray-700">{remaining}/{limits.daily}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-amber-500' : 'bg-primary-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}


