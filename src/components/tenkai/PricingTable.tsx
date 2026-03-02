'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

// ============================================
// Types
// ============================================
interface PricingTableProps {
  currentPlan?: string // 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'
}

// ============================================
// プラン定義
// ============================================
interface Plan {
  key: string
  name: string
  monthlyPrice: number
  annualPrice: number
  priceLabel: string
  annualPriceLabel: string
  description: string
  recommended: boolean
  features: Record<string, string | boolean>
  cta: string
}

const PLANS: Plan[] = [
  {
    key: 'FREE',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    priceLabel: '0円',
    annualPriceLabel: '0円',
    description: 'お試し利用に最適',
    recommended: false,
    features: {
      generations: '月10回',
      platforms: '3プラットフォーム',
      inputChars: '5,000文字',
      videoInput: false,
      brandVoice: '1つ',
      templates: 'ベーシック',
      team: false,
      api: false,
    },
    cta: 'Free',
  },
  {
    key: 'STARTER',
    name: 'Starter',
    monthlyPrice: 2980,
    annualPrice: 2384,
    priceLabel: '2,980円',
    annualPriceLabel: '2,384円',
    description: '個人クリエイター向け',
    recommended: false,
    features: {
      generations: '月50回',
      platforms: '5プラットフォーム',
      inputChars: '20,000文字',
      videoInput: false,
      brandVoice: '3つ',
      templates: 'すべて',
      team: false,
      api: false,
    },
    cta: 'Starter',
  },
  {
    key: 'PRO',
    name: 'Pro',
    monthlyPrice: 9800,
    annualPrice: 7840,
    priceLabel: '9,800円',
    annualPriceLabel: '7,840円',
    description: 'ビジネス利用に最適',
    recommended: true,
    features: {
      generations: '月200回',
      platforms: '9プラットフォーム',
      inputChars: '50,000文字',
      videoInput: true,
      brandVoice: '無制限',
      templates: 'すべて + カスタム',
      team: '5名まで',
      api: true,
    },
    cta: 'Pro',
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    monthlyPrice: 29800,
    annualPrice: 23840,
    priceLabel: '29,800円〜',
    annualPriceLabel: '23,840円〜',
    description: '大規模チーム向け',
    recommended: false,
    features: {
      generations: '無制限',
      platforms: '9プラットフォーム',
      inputChars: '無制限',
      videoInput: true,
      brandVoice: '無制限',
      templates: 'すべて + カスタム',
      team: '無制限',
      api: true,
    },
    cta: 'Enterprise',
  },
]

// ============================================
// 機能行の定義
// ============================================
const FEATURE_ROWS = [
  { key: 'generations', label: '月間生成回数', icon: 'auto_awesome' },
  { key: 'platforms', label: '対応プラットフォーム数', icon: 'devices' },
  { key: 'inputChars', label: '入力文字数', icon: 'text_fields' },
  { key: 'videoInput', label: '動画入力', icon: 'videocam' },
  { key: 'brandVoice', label: 'ブランドボイス', icon: 'record_voice_over' },
  { key: 'templates', label: 'テンプレート', icon: 'description' },
  { key: 'team', label: 'チーム', icon: 'group' },
  { key: 'api', label: 'API', icon: 'api' },
]

// ============================================
// PricingTable コンポーネント
// ============================================
export default function PricingTable({ currentPlan = 'FREE' }: PricingTableProps) {
  const [isAnnual, setIsAnnual] = useState(false)
  const router = useRouter()

  // 現在のプランを正規化
  const normalizedPlan = currentPlan.toUpperCase()

  const handleUpgrade = async (planKey: string) => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: `tenkai_${planKey}` }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
          return
        }
      }
      alert('決済ページの取得に失敗しました')
    } catch {
      alert('エラーが発生しました')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-slate-900 mb-3">
          プランと料金
        </h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          あなたのニーズに合ったプランをお選びください。
          いつでもアップグレード・ダウングレードが可能です。
        </p>
      </div>

      {/* 年額/月額トグル */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <span
          className={`text-sm font-semibold ${
            !isAnnual ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          月額
        </span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className={`relative w-14 h-8 rounded-full transition-colors ${
            isAnnual ? 'bg-blue-500' : 'bg-slate-300'
          }`}
        >
          <motion.div
            className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md"
            animate={{ left: isAnnual ? '1.75rem' : '0.25rem' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
        <span
          className={`text-sm font-semibold ${
            isAnnual ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          年額
        </span>
        {isAnnual && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full"
          >
            20%お得
          </motion.span>
        )}
      </div>

      {/* ======== プランカード (モバイル: スタック / デスクトップ: 横並び) ======== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
        {PLANS.map((plan, index) => {
          const isCurrent = normalizedPlan === plan.key
          const price = isAnnual ? plan.annualPriceLabel : plan.priceLabel

          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
                plan.recommended
                  ? 'border-blue-500 shadow-xl shadow-blue-500/10'
                  : isCurrent
                  ? 'border-blue-300 shadow-md'
                  : 'border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {/* おすすめバッジ */}
              {plan.recommended && (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-center py-1.5 text-xs font-bold uppercase tracking-wider">
                  おすすめ
                </div>
              )}

              <div className="p-6">
                {/* プラン名 */}
                <h3 className="text-lg font-black text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{plan.description}</p>

                {/* 価格 */}
                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-black text-slate-900">{price}</span>
                    {plan.monthlyPrice > 0 && (
                      <span className="text-sm text-slate-400 mb-1">/ 月</span>
                    )}
                  </div>
                  {isAnnual && plan.monthlyPrice > 0 && (
                    <p className="text-xs text-slate-400 mt-1 line-through">
                      月額 {plan.priceLabel}
                    </p>
                  )}
                </div>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-sm font-bold text-center bg-slate-100 text-slate-500">
                    現在のプラン
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.key)}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                      plan.recommended
                        ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    アップグレード
                  </button>
                )}

                {/* 機能リスト (カード内) */}
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                  {FEATURE_ROWS.map((row) => {
                    const value = plan.features[row.key]
                    const isBoolean = typeof value === 'boolean'

                    return (
                      <div key={row.key} className="flex items-center gap-2">
                        {isBoolean ? (
                          value ? (
                            <span className="material-symbols-outlined text-lg text-emerald-500">
                              check_circle
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-lg text-slate-300">
                              cancel
                            </span>
                          )
                        ) : (
                          <span className="material-symbols-outlined text-lg text-blue-500">
                            check_circle
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-slate-500">{row.label}</span>
                        </div>
                        {!isBoolean && (
                          <span className="text-xs font-semibold text-slate-700 text-right">
                            {value as string}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ======== 比較テーブル (デスクトップ) ======== */}
      <div className="hidden lg:block">
        <h3 className="text-xl font-bold text-slate-900 text-center mb-6">
          プラン比較
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-4 text-sm font-bold text-slate-500 w-52">
                  機能
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.key}
                    className={`text-center px-4 py-4 text-sm font-bold ${
                      plan.recommended
                        ? 'text-blue-600 bg-blue-50/50'
                        : normalizedPlan === plan.key
                        ? 'text-blue-500'
                        : 'text-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{plan.name}</span>
                      {normalizedPlan === plan.key && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded-full">
                          現在
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, rowIndex) => (
                <tr
                  key={row.key}
                  className={`border-b border-slate-50 ${
                    rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  }`}
                >
                  <td className="px-6 py-3.5 text-sm text-slate-600 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-slate-400">
                      {row.icon}
                    </span>
                    {row.label}
                  </td>
                  {PLANS.map((plan) => {
                    const value = plan.features[row.key]
                    const isBoolean = typeof value === 'boolean'

                    return (
                      <td
                        key={plan.key}
                        className={`text-center px-4 py-3.5 text-sm ${
                          plan.recommended ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        {isBoolean ? (
                          value ? (
                            <span className="material-symbols-outlined text-xl text-emerald-500">
                              check_circle
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-xl text-slate-300">
                              remove
                            </span>
                          )
                        ) : (
                          <span className="font-semibold text-slate-700">{value as string}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQセクション */}
      <div className="mt-16 text-center">
        <p className="text-slate-500 text-sm">
          ご不明な点がございましたら、
          <a href="/tenkai/pricing" className="text-blue-600 font-semibold hover:underline">
            お問い合わせ
          </a>
          ください。
        </p>
      </div>
    </div>
  )
}
