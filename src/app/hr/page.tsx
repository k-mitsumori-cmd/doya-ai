'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { HR_PRICING } from '@/lib/pricing'

const FEATURES = [
  {
    icon: 'people',
    title: '従業員データベース',
    description: '顔写真中心の従業員管理。部署・役職・等級をまとめて一元管理。CSVインポートにも対応。',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    character: '/hr/characters/working_作業中.png',
  },
  {
    icon: 'assessment',
    title: '評価管理',
    description: 'MBO評価をオンラインで完結。目標設定からスコアリング、フィードバックまでをワンストップで。',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    character: '/hr/characters/point_解説.png',
  },
  {
    icon: 'forum',
    title: '1on1記録',
    description: 'アジェンダ設定からメモ、アクションアイテムまで。1on1の質を高め、成長を可視化。',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    character: '/hr/characters/present_プレゼン.png',
  },
  {
    icon: 'auto_awesome',
    title: 'AI分析',
    description: 'AIが評価コメントを自動生成、1on1の内容を自動要約。データドリブンな人材マネジメントを実現。',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
    character: '/hr/characters/surprise_驚き.png',
  },
]

export default function HrLandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-32 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-green-50" />
        {/* Google-style colorful blurred circles */}
        <div className="absolute top-10 right-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl" />
        <div className="absolute top-40 left-1/3 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-56 h-56 bg-red-300/15 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white shadow-md rounded-full mb-8">
                <span className="material-symbols-outlined text-blue-600 text-lg">groups</span>
                <span className="text-sm font-semibold text-slate-700">中小企業のためのタレントマネジメント</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black text-slate-900 mb-6 tracking-tight">
                人を活かす<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">AI</span>。
              </h1>

              <p className="text-xl lg:text-2xl font-medium text-slate-600 max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                従業員データベース、組織図、人事評価、1on1記録をまとめて管理。
                <br className="hidden sm:block" />
                AIが評価コメントの生成や1on1の要約を自動化します。
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/hr/dashboard"
                    className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-blue-600 text-white rounded-full text-xl font-black shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:bg-blue-700 transition-all"
                  >
                    <span className="material-symbols-outlined">rocket_launch</span>
                    無料で始める
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/hr/pricing"
                    className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-slate-700 rounded-full text-xl font-black shadow-md hover:shadow-lg transition-all"
                  >
                    料金プランを見る
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            {/* Hero Character */}
            <motion.img
              src="/hr/characters/hello_挨拶.png"
              alt="白くまキャラクター"
              className="w-40 sm:w-48 lg:w-80 drop-shadow-xl"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, y: [0, -12, 0] }}
              transition={{
                opacity: { duration: 0.6, delay: 0.3 },
                scale: { duration: 0.6, delay: 0.3 },
                y: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
              }}
            />
          </div>

          {/* Social Proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-10 text-sm font-bold text-slate-400"
          >
            まもなく正式リリース — 先行登録を受付中
          </motion.p>

          {/* Scroll chevron */}
          <motion.div
            className="flex justify-center mt-8"
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          >
            <span className="material-symbols-outlined text-3xl text-slate-300">expand_more</span>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 mb-4">すべてが揃った、かんたんHR</h2>
            <p className="text-base font-medium text-slate-500">Excelやメールでのバラバラ管理を卒業しませんか？</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.03, y: -4 }}
                className="relative bg-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition-shadow overflow-hidden"
              >
                <div className={`w-12 h-12 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-4`}>
                  <span className={`material-symbols-outlined text-2xl ${feature.iconColor}`}>{feature.icon}</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-base text-slate-500 leading-relaxed">{feature.description}</p>
                <img
                  src={feature.character}
                  alt=""
                  className="absolute bottom-2 right-2 w-20 opacity-20 pointer-events-none select-none"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 mb-4">料金プラン</h2>
            <p className="text-base font-medium text-slate-500">5名までは永久無料。成長に合わせてアップグレード。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HR_PRICING.plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-white rounded-3xl p-6 ${
                  plan.popular ? 'shadow-2xl ring-2 ring-blue-500' : 'shadow-lg'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                    人気
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 text-lg">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-slate-900">{plan.priceLabel}</span>
                  {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-base">
                      <span
                        className={`material-symbols-outlined text-base mt-0.5 ${f.included ? 'text-emerald-500' : 'text-slate-300'}`}
                        style={f.included ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {f.included ? 'check_circle' : 'cancel'}
                      </span>
                      <span className={f.included ? 'text-slate-700' : 'text-slate-400'}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/hr/dashboard"
                  className={`block w-full py-3 text-center text-base font-bold rounded-full transition-all ${
                    plan.popular
                      ? 'bg-blue-600 text-white shadow-md hover:shadow-lg hover:bg-blue-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-12 text-white shadow-2xl shadow-blue-500/20 overflow-hidden"
          >
            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-3xl font-black mb-4">今すぐ始めましょう</h2>
                <p className="text-lg text-blue-100 mb-8">
                  5名まで永久無料。クレジットカード不要で今すぐ始められます。
                </p>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="inline-block">
                  <Link
                    href="/hr/dashboard"
                    className="inline-flex items-center gap-2 px-10 py-5 bg-white text-blue-600 rounded-full text-xl font-black shadow-lg hover:shadow-xl transition-all"
                  >
                    <span className="material-symbols-outlined">rocket_launch</span>
                    無料で始める
                  </Link>
                </motion.div>
              </div>
              <motion.img
                src="/hr/characters/jump_大喜び.png"
                alt="白くまキャラクター"
                className="w-28 sm:w-40 drop-shadow-xl"
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
