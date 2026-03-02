'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'

// ============================================
// プラン定義
// ============================================
const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '¥0',
    period: '永久無料',
    description: 'まずは試してみたい方に',
    features: [
      { text: '月10回の生成', included: true },
      { text: '3プラットフォーム対応', included: true },
      { text: 'テキスト入力のみ', included: true },
      { text: '基本テンプレート', included: true },
      { text: 'ブランドボイス（1つ）', included: true },
      { text: 'URL / YouTube入力', included: false },
      { text: 'カスタムテンプレート', included: false },
      { text: 'API アクセス', included: false },
      { text: '優先サポート', included: false },
    ],
    cta: '現在のプラン',
    popular: false,
    gradient: 'from-slate-400 to-slate-500',
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '¥2,980',
    period: '/月',
    description: '個人クリエイター向け',
    features: [
      { text: '月50回の生成', included: true },
      { text: '5プラットフォーム対応', included: true },
      { text: 'テキスト・URL入力', included: true },
      { text: '全テンプレート', included: true },
      { text: 'ブランドボイス（3つ）', included: true },
      { text: 'YouTube入力', included: true },
      { text: 'カスタムテンプレート', included: true },
      { text: 'API アクセス', included: false },
      { text: '優先サポート', included: false },
    ],
    cta: 'アップグレード',
    popular: false,
    gradient: 'from-blue-400 to-blue-500',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '¥9,800',
    period: '/月',
    description: 'ビジネスで本格活用',
    features: [
      { text: '月200回の生成', included: true },
      { text: '全9プラットフォーム対応', included: true },
      { text: '全入力方式対応', included: true },
      { text: '全テンプレート', included: true },
      { text: 'ブランドボイス（無制限）', included: true },
      { text: 'YouTube / 動画入力', included: true },
      { text: 'カスタムテンプレート', included: true },
      { text: 'API アクセス', included: true },
      { text: '優先サポート', included: true },
    ],
    cta: 'アップグレード',
    popular: true,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '¥29,800〜',
    period: '/月',
    description: '大規模チーム向け',
    features: [
      { text: '無制限の生成', included: true },
      { text: '全9プラットフォーム対応', included: true },
      { text: '全入力方式対応', included: true },
      { text: '全テンプレート', included: true },
      { text: 'ブランドボイス（無制限）', included: true },
      { text: 'チーム管理', included: true },
      { text: 'カスタムAPI', included: true },
      { text: 'SSO対応', included: true },
      { text: '専任サポート', included: true },
    ],
    cta: 'お問い合わせ',
    popular: false,
    gradient: 'from-slate-700 to-slate-900',
  },
] as const

// ============================================
// FAQ
// ============================================
const FAQS = [
  {
    q: 'プランの変更はいつでもできますか？',
    a: 'はい、いつでもアップグレードまたはダウングレードが可能です。アップグレードは即時反映され、ダウングレードは次の請求サイクルから適用されます。',
  },
  {
    q: '無料プランの制限は何ですか？',
    a: '月10回の生成と3プラットフォーム（note, Blog, X）への対応が含まれます。テキスト入力のみ対応しており、URL入力やYouTube入力は有料プランで利用可能です。',
  },
  {
    q: '生成回数のリセットはいつですか？',
    a: '毎月1日に自動リセットされます。未使用分の繰り越しはありません。',
  },
  {
    q: '支払い方法は何がありますか？',
    a: 'クレジットカード（Visa, Mastercard, JCB, American Express）に対応しています。Enterpriseプランでは請求書払いも可能です。',
  },
  {
    q: '解約するとデータはどうなりますか？',
    a: '解約後30日間はデータが保持されます。その後、完全に削除されます。解約前にデータのエクスポートをお勧めします。',
  },
  {
    q: 'APIアクセスとは何ですか？',
    a: 'RESTful APIを通じてプログラムから直接コンテンツ生成を行えます。自社システムとの連携や大量処理に最適です。Pro以上のプランで利用可能です。',
  },
]

// ============================================
// FAQ Item
// ============================================
function FAQItem({ q, a }: { q: string; a: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-900 pr-4">{q}</span>
        <span
          className={`material-symbols-outlined text-xl text-slate-400 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">
              <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// Pricing Page
// ============================================
export default function PricingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const currentPlan = session?.user?.plan?.toLowerCase() || 'free'

  const handleUpgrade = async (planKey: string) => {
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }
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
      alert('決済ページの取得に失敗しました。しばらく後に再試行してください。')
    } catch {
      alert('エラーが発生しました。しばらく後に再試行してください。')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      {/* ======== Header ======== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold text-slate-900 mb-3"
          >
            料金プラン
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base text-slate-500 max-w-lg mx-auto"
          >
            あなたのニーズに合ったプランを選択して、コンテンツの展開力を最大化しましょう
          </motion.p>
        </div>

        {/* ======== Pricing Cards ======== */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {PLANS.map((plan, index) => {
            const isCurrentPlan = currentPlan === plan.key
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                className={`relative bg-white rounded-2xl border-2 ${
                  plan.popular
                    ? 'border-blue-500 shadow-xl shadow-blue-500/10'
                    : 'border-slate-200 shadow-sm'
                } overflow-hidden`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] font-bold px-4 py-1 rounded-bl-xl">
                      人気 No.1
                    </div>
                  </div>
                )}

                <div className="p-6">
                  {/* Plan name + price */}
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mb-4">{plan.description}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm text-slate-400">{plan.period}</span>
                    )}
                  </div>

                  {/* CTA */}
                  {plan.key === 'enterprise' ? (
                    <a
                      href="mailto:support@doya-tenkai.ai"
                      className={`block w-full py-3 text-center rounded-xl text-sm font-bold bg-gradient-to-r ${plan.gradient} text-white shadow-lg transition-all hover:shadow-xl`}
                    >
                      {plan.cta}
                    </a>
                  ) : isCurrentPlan ? (
                    <div className="w-full py-3 text-center rounded-xl text-sm font-bold bg-slate-100 text-slate-400 cursor-default">
                      現在のプラン
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.key)}
                      className={`w-full py-3 text-center rounded-xl text-sm font-bold bg-gradient-to-r ${plan.gradient} text-white shadow-lg transition-all hover:shadow-xl`}
                    >
                      {plan.cta}
                    </button>
                  )}

                  {/* Features */}
                  <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                    {plan.features.map((feature, fIndex) => (
                      <div key={fIndex} className="flex items-center gap-2.5">
                        <span
                          className={`material-symbols-outlined text-base ${
                            feature.included ? 'text-blue-500' : 'text-slate-300'
                          }`}
                        >
                          {feature.included ? 'check_circle' : 'cancel'}
                        </span>
                        <span
                          className={`text-sm ${
                            feature.included ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* ======== Enterprise CTA ======== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 sm:p-10 text-center mb-16"
        >
          <h2 className="text-2xl font-bold text-white mb-3">
            大規模チームでの導入をお考えですか？
          </h2>
          <p className="text-sm text-slate-300 mb-6 max-w-lg mx-auto">
            Enterprise プランでは、無制限の生成、チーム管理、SSO対応、専任サポートをご利用いただけます。
            お気軽にお問い合わせください。
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="mailto:support@doya-tenkai.ai"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-lg hover:shadow-xl transition-all"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              お問い合わせ
            </a>
            <a
              href="#"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white text-sm font-bold border border-white/20 hover:bg-white/20 transition-all"
            >
              <span className="material-symbols-outlined text-lg">calendar_month</span>
              デモを予約
            </a>
          </div>
        </motion.div>

        {/* ======== FAQ ======== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">
            よくある質問
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </motion.div>

        {/* ======== Bottom CTA ======== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center pb-12"
        >
          <p className="text-sm text-slate-400 mb-4">
            まだ迷っていますか？無料プランで今すぐお試しいただけます。
          </p>
          <Link
            href="/tenkai/create"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all"
          >
            <span className="material-symbols-outlined">rocket_launch</span>
            無料で始める
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}
