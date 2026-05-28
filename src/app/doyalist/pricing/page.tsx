'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'

/* ──────────────────────────────────────────────
   型定義
   ────────────────────────────────────────────── */

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  price: string
  priceNote: string
  description: string
  highlighted: boolean
  features: PlanFeature[]
  cta: string
  icon: string
}

/* ──────────────────────────────────────────────
   プランデータ
   ────────────────────────────────────────────── */

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'フリー',
    price: '¥0',
    priceNote: '/月',
    description: 'まずは無料で試してみたい方に',
    highlighted: false,
    icon: 'explore',
    features: [
      { text: '月3リストまで作成', included: true },
      { text: '各リスト20社まで', included: true },
      { text: '法人番号検索のみ', included: true },
      { text: 'AI分析', included: false },
      { text: 'アプローチ文面生成', included: false },
      { text: 'gBizINFO連携', included: false },
      { text: 'CSVエクスポート', included: false },
    ],
    cta: '現在のプラン',
  },
  {
    id: 'light',
    name: 'ライト',
    price: '¥2,980',
    priceNote: '/月（税込）',
    description: 'AI分析で営業リストの質を向上',
    highlighted: false,
    icon: 'lightbulb',
    features: [
      { text: '月10リストまで作成', included: true },
      { text: '各リスト50社まで', included: true },
      { text: 'gBizINFO連携', included: true },
      { text: 'AI分析・スコアリング', included: true },
      { text: 'アプローチ文面生成', included: false },
      { text: 'Webスクレイピング', included: false },
      { text: 'CSVエクスポート', included: false },
    ],
    cta: 'ライトプランを始める',
  },
  {
    id: 'pro',
    name: 'プロ',
    price: '¥9,980',
    priceNote: '/月（税込）',
    description: '本格的に営業リストを活用したい方に',
    highlighted: true,
    icon: 'bolt',
    features: [
      { text: '月30リストまで作成', included: true },
      { text: '各リスト100社まで', included: true },
      { text: 'gBizINFO連携', included: true },
      { text: 'AI分析・スコアリング', included: true },
      { text: 'アプローチ文面自動生成', included: true },
      { text: 'Webスクレイピング', included: true },
      { text: 'CSVエクスポート', included: true },
    ],
    cta: 'プロプランを始める',
  },
  {
    id: 'enterprise',
    name: 'エンタープライズ',
    price: '¥49,800',
    priceNote: '/月（税込）',
    description: '大規模なリスト運用とAPI連携が必要な方に',
    highlighted: false,
    icon: 'corporate_fare',
    features: [
      { text: '月200リストまで作成', included: true },
      { text: '各リスト500社まで', included: true },
      { text: 'gBizINFO連携', included: true },
      { text: 'AI分析・スコアリング', included: true },
      { text: 'アプローチ文面自動生成', included: true },
      { text: 'Webスクレイピング', included: true },
      { text: 'CSVエクスポート', included: true },
      { text: 'API連携', included: true },
      { text: '優先サポート', included: true },
    ],
    cta: 'エンタープライズを始める',
  },
]

/* ──────────────────────────────────────────────
   比較テーブルデータ
   ────────────────────────────────────────────── */

const COMPARISON_ROWS = [
  { feature: 'リスト作成数', free: '月3回', light: '月10回', pro: '月30回', enterprise: '月200回' },
  { feature: '1リストあたりの企業数', free: '20社', light: '50社', pro: '100社', enterprise: '500社' },
  { feature: '法人番号検索', free: 'check', light: 'check', pro: 'check', enterprise: 'check' },
  { feature: 'gBizINFO連携', free: 'x', light: 'check', pro: 'check', enterprise: 'check' },
  { feature: 'AI分析・スコアリング', free: 'x', light: 'check', pro: 'check', enterprise: 'check' },
  { feature: 'アプローチ文面生成', free: 'x', light: 'x', pro: 'check', enterprise: 'check' },
  { feature: 'Webスクレイピング', free: 'x', light: 'x', pro: 'check', enterprise: 'check' },
  { feature: 'CSVエクスポート', free: 'x', light: 'x', pro: 'check', enterprise: 'check' },
  { feature: 'API連携', free: 'x', light: 'x', pro: 'x', enterprise: 'check' },
  { feature: 'サポート', free: 'メール', light: 'メール', pro: '優先メール', enterprise: '優先サポート' },
]

/* ──────────────────────────────────────────────
   FAQデータ
   ────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    question: '解約方法を教えてください',
    answer:
      'アカウント設定画面からいつでも解約できます。解約手続き後も、現在の請求期間が終了するまですべての機能をご利用いただけます。違約金等は一切発生しません。',
  },
  {
    question: '無料トライアルはありますか？',
    answer:
      'フリープランを無期限でご利用いただけます。月3リスト・各20社までの制限がありますが、基本機能はすべてお試しいただけます。ライト・プロ・エンタープライズへのアップグレードもいつでも可能です。',
  },
  {
    question: 'プランの変更はいつでもできますか？',
    answer:
      'はい、いつでもアップグレード・ダウングレードが可能です。アップグレードは即時反映され、差額は日割り計算されます。ダウングレードは現在の請求期間終了後に反映されます。',
  },
  {
    question: '解約後のデータ移行はどうなりますか？',
    answer:
      '解約後も作成済みのリストデータは90日間保持されます。その間にCSV出力でデータをエクスポートするか、再契約いただければデータを引き続きご利用いただけます。',
  },
  {
    question: '支払い方法は何に対応していますか？',
    answer:
      'クレジットカード（Visa, Mastercard, American Express, JCB）に対応しています。請求書払いをご希望の場合はお問い合わせください。',
  },
  {
    question: 'API連携とは何ですか？',
    answer:
      'エンタープライズプランではREST APIを通じて、リスト作成・企業情報取得・アプローチ文面生成を外部システムから呼び出すことができます。CRM連携やワークフロー自動化に最適です。',
  },
]

/* ──────────────────────────────────────────────
   アニメーション定義
   ────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 40, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.15, type: "spring", bounce: 0.3 },
  }),
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

/* ──────────────────────────────────────────────
   カウントアップコンポーネント
   ────────────────────────────────────────────── */

function PriceCountUp({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!isInView) return
    if (value === 0) { setDisplay(0); return }
    const duration = 1200
    const steps = 30
    const stepDuration = duration / steps
    let current = 0
    const increment = value / steps
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.floor(current))
      }
    }, stepDuration)
    return () => clearInterval(timer)
  }, [isInView, value])

  return (
    <span ref={ref}>
      {prefix}{display.toLocaleString('ja-JP')}
    </span>
  )
}

/* ──────────────────────────────────────────────
   メインコンポーネント
   ────────────────────────────────────────────── */

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId)
    try {
      const res = await fetch('/api/doyalist/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (data.url) {
        // Stripe Checkout URLは外部URLのためwindow.locationで遷移
        window.location.href = data.url
      } else if (data.error) {
        alert(data.error)
      }
    } catch (err) {
      console.error('チェックアウトエラー:', err)
      alert('チェックアウト処理中にエラーが発生しました')
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══════════════════════════════════════
          Hero Section
          ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-blue-50/30">
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full text-sm font-semibold text-blue-600 border border-blue-200 shadow-sm mb-6">
              <span className="material-symbols-outlined text-base">diamond</span>
              料金プラン
            </div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <motion.img
                src="/characters/present_プレゼン.png"
                alt=""
                className="w-20 h-20 object-contain rounded-full"
                animate={{ y: [0, -10, 0], rotate: [-3, 3, -3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-800 leading-tight">
                あなたのビジネスに最適なプラン
              </h1>
            </div>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
              AIが自動で営業リストを作成。ターゲット企業の発見からアプローチまで
              <br className="hidden sm:block" />
              一気通貫でサポートします。
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          Pricing Cards
          ═══════════════════════════════════════ */}
      <section className="relative max-w-7xl mx-auto px-6 pb-16">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-start"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {PLANS.map((plan, index) => {
            const isFree = plan.id === 'free'
            const isLight = plan.id === 'light'
            const isPro = plan.id === 'pro'
            const isEnterprise = plan.id === 'enterprise'
            const priceValue = isFree ? 0 : isLight ? 2980 : isPro ? 9980 : 49800

            return (
              <motion.div
                key={plan.id}
                custom={index}
                variants={fadeUp}
                className={`
                  relative flex flex-col rounded-3xl bg-white shadow-sm border overflow-hidden
                  ${isPro
                    ? 'lg:scale-105 lg:-my-2 z-10 border-blue-200 shadow-lg shadow-blue-100/50'
                    : 'border-slate-100'
                  }
                  transition-transform duration-300 hover:-translate-y-1
                `}
              >
                {/* PRO カード上部アクセントバー + キラキラ */}
                {isPro && (
                  <>
                    <div className="h-1.5 bg-blue-500" />
                    {/* 回転するキラキラ */}
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-amber-300"
                        style={{
                          top: i < 2 ? '12px' : 'auto',
                          bottom: i >= 2 ? '12px' : 'auto',
                          left: i % 2 === 0 ? '12px' : 'auto',
                          right: i % 2 === 1 ? '12px' : 'auto',
                        }}
                        animate={{
                          scale: [0.5, 1.2, 0.5],
                          opacity: [0.3, 1, 0.3],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.5,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                  </>
                )}

                {/* ライトカード上部アクセントバー */}
                {isLight && (
                  <div className="h-1.5 bg-sky-400" />
                )}

                {/* ENTERPRISEカード上部アクセントバー */}
                {isEnterprise && (
                  <div className="h-1.5 bg-slate-400" />
                )}

                <div className="p-6 lg:p-8 flex flex-col flex-1">
                  {/* おすすめバッジ */}
                  {isPro && (
                    <div className="mb-4 flex items-center gap-2">
                      <motion.span
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full"
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span className="material-symbols-outlined text-sm">star</span>
                        おすすめ
                      </motion.span>
                      <motion.img
                        src="/characters/love_大好き.png"
                        alt=""
                        className="w-10 h-10 object-contain rounded-full"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                  )}

                  {/* プラン名・アイコン */}
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${isFree ? 'bg-slate-100 text-slate-500' : ''}
                        ${isLight ? 'bg-sky-100 text-sky-600' : ''}
                        ${isPro ? 'bg-blue-100 text-blue-600' : ''}
                        ${isEnterprise ? 'bg-slate-100 text-slate-600' : ''}
                      `}
                    >
                      <span className="material-symbols-outlined text-xl">{plan.icon}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 tracking-wide">
                      {plan.name}
                    </h3>
                  </div>

                  {/* 説明 */}
                  <p className="text-sm text-slate-500 mb-6">
                    {plan.description}
                  </p>

                  {/* 価格 (カウントアップ) */}
                  <div className="mb-8">
                    <span className="text-3xl lg:text-4xl font-bold text-slate-800">
                      <PriceCountUp
                        value={priceValue}
                        prefix="¥"
                      />
                    </span>
                    <span className="text-sm ml-1 text-slate-400">
                      {plan.priceNote}
                    </span>
                  </div>

                  {/* 区切り線 */}
                  <div className="border-t border-slate-100 mb-6" />

                  {/* 機能リスト */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span
                          className={`material-symbols-outlined text-lg mt-0.5 flex-shrink-0 ${
                            feature.included
                              ? 'text-emerald-500'
                              : 'text-slate-300'
                          }`}
                        >
                          {feature.included ? 'check_circle' : 'cancel'}
                        </span>
                        <span
                          className={`text-sm leading-relaxed ${
                            feature.included
                              ? 'text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA ボタン */}
                  {isFree ? (
                    <div
                      className="w-full px-6 py-3.5 text-center text-sm font-medium text-slate-500 bg-slate-50 rounded-full border border-slate-200"
                    >
                      {plan.cta}
                    </div>
                  ) : isPro ? (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading === plan.id}
                      className="block w-full text-center px-6 py-3.5 font-bold text-sm text-white rounded-full bg-blue-500 shadow-lg shadow-blue-200/50 hover:bg-blue-600 hover:shadow-blue-300/60 transition-all duration-200 disabled:opacity-50"
                    >
                      {checkoutLoading === plan.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                          処理中...
                        </span>
                      ) : (
                        plan.cta
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading === plan.id}
                      className="block w-full text-center px-6 py-3.5 font-medium text-sm rounded-full border-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 disabled:opacity-50"
                    >
                      {checkoutLoading === plan.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                          処理中...
                        </span>
                      ) : (
                        plan.cta
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          Feature Comparison Table
          ═══════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">
            プラン機能比較
          </h2>
          <p className="text-sm text-slate-500 text-center mb-8">
            各プランで利用できる機能の詳細をご確認ください
          </p>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-4 px-6 text-slate-500 font-bold w-[28%]">
                      機能
                    </th>
                    <th className="text-center py-4 px-3 w-[18%]">
                      <span className="text-slate-600 font-bold">フリー</span>
                    </th>
                    <th className="text-center py-4 px-3 w-[18%]">
                      <span className="text-sky-600 font-bold">ライト</span>
                    </th>
                    <th className="text-center py-4 px-3 w-[18%]">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-blue-600 font-extrabold">プロ</span>
                        <span className="material-symbols-outlined text-amber-500 text-base">star</span>
                      </div>
                    </th>
                    <th className="text-center py-4 px-3 w-[18%]">
                      <span className="text-slate-900 font-bold text-xs">エンタープライズ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-slate-100 ${
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } hover:bg-blue-50/30 transition-colors`}
                    >
                      <td className="py-3.5 px-6 text-slate-800 font-bold">
                        {row.feature}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <CellValue value={row.free} variant="free" />
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <CellValue value={row.light} variant="light" />
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <CellValue value={row.pro} variant="pro" />
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <CellValue value={row.enterprise} variant="enterprise" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          FAQ Section
          ═══════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
              <span className="material-symbols-outlined text-blue-500 text-2xl">help</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              よくある質問
            </h2>
            <p className="text-sm text-slate-500">
              ご不明な点がございましたらお気軽にお問い合わせください
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        openFaq === index
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        question_mark
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{item.question}</span>
                  </div>
                  <motion.span
                    className="material-symbols-outlined text-slate-400 text-xl flex-shrink-0 ml-3"
                    animate={{ rotate: openFaq === index ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    expand_more
                  </motion.span>
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pl-16">
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          Bottom CTA
          ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white border-t border-slate-100">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="relative max-w-3xl mx-auto px-6 py-16 sm:py-20 text-center"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-full mb-6">
            <span className="material-symbols-outlined text-blue-500 text-3xl">rocket_launch</span>
          </div>
          <motion.img
            src="/characters/jump_大喜び.png"
            alt=""
            className="w-24 h-24 object-contain mx-auto mb-4 rounded-full"
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">
            まずは無料で始めましょう
          </h3>
          <p className="text-base text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">
            無料プランですべての基本機能をお試しいただけます。
            <br />
            アップグレードはいつでも可能です。
          </p>
          <Link
            href="/doyalist/new"
            className="inline-flex items-center gap-2.5 px-10 py-4 bg-blue-500 text-white font-bold text-base rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 hover:shadow-blue-300/60 hover:scale-[1.02] transition-all duration-200"
          >
            <span className="material-symbols-outlined text-xl">rocket_launch</span>
            無料で営業リストを作成する
          </Link>
          <p className="mt-4 text-sm text-slate-400">
            クレジットカード不要 ・ 30秒で開始
          </p>
        </motion.div>
      </section>
    </div>
  )
}

/* ──────────────────────────────────────────────
   比較テーブル セル値コンポーネント
   ────────────────────────────────────────────── */

function CellValue({
  value,
  variant,
}: {
  value: string
  variant: 'free' | 'light' | 'pro' | 'enterprise'
}) {
  if (value === 'check') {
    return (
      <span
        className={`material-symbols-outlined text-lg ${
          variant === 'pro' ? 'text-blue-500' : variant === 'light' ? 'text-sky-500' : 'text-green-500'
        }`}
      >
        check_circle
      </span>
    )
  }
  if (value === 'x') {
    return (
      <span className="material-symbols-outlined text-lg text-slate-300">
        close
      </span>
    )
  }
  return (
    <span
      className={`text-sm font-semibold ${
        variant === 'pro' ? 'text-blue-700' : variant === 'light' ? 'text-sky-700' : 'text-slate-700'
      }`}
    >
      {value}
    </span>
  )
}
