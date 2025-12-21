'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Crown, LogIn, Check } from 'lucide-react'
import { getServiceById } from '@/lib/services'
import { BANNER_PRICING } from '@/lib/pricing'

// カテゴリ一覧
const categories = [
  { id: 'telecom', name: '通信向け', icon: '📱', desc: '格安SIM・光回線', color: 'from-blue-500 to-blue-500' },
  { id: 'marketing', name: 'マーケティング', icon: '📊', desc: 'リード獲得', color: 'from-blue-500 to-blue-500' },
  { id: 'ec', name: 'EC向け', icon: '🛒', desc: 'セール・キャンペーン', color: 'from-amber-500 to-orange-500' },
  { id: 'recruit', name: '採用向け', icon: '👥', desc: '求人・説明会', color: 'from-blue-500 to-green-500' },
  { id: 'beauty', name: '美容・コスメ', icon: '💄', desc: 'スキンケア・化粧品', color: 'from-blue-500 to-blue-500' },
  { id: 'food', name: '飲食・フード', icon: '🍽️', desc: 'レストラン・デリバリー', color: 'from-red-500 to-orange-500' },
]

export default function BannerLandingPage() {
  const { data: session } = useSession()
  const service = getServiceById('banner')!
  const plan = (session?.user as any)?.bannerPlan || 'FREE'
  const isPro = plan === 'PRO'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-blue-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← ポータル
            </Link>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-800 text-lg tracking-tight">Bunridge</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                {isPro ? (
                  <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-600 text-white text-sm font-medium rounded-full">
                    <Crown className="w-4 h-4" />
                    プロ
                  </div>
                ) : (
                  <Link href="/banner/pricing" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    アップグレード
                  </Link>
                )}
                <Link href="/banner" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  ツールを開く
                </Link>
              </>
            ) : (
              <Link href="/auth/signin?service=banner" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                <LogIn className="w-4 h-4" />
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 text-orange-500" />
            Bunridge AI Generation
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-6 tracking-tight">
            プロ品質のバナーを<br />
            <span className="text-blue-600">一瞬で可視化する</span>
          </h1>
          <p className="text-lg text-gray-600 mb-10 leading-relaxed">
            カテゴリを選んでキーワードを入力するだけ。<br />
            Bunridge AIがクリエイティブな3案を同時に生成します。
          </p>

          {session ? (
            <Link href="/banner">
              <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 mx-auto active:scale-95">
                ダッシュボードを開く
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          ) : (
            <Link href="/auth/signin?service=banner">
              <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 mx-auto active:scale-95">
                無料で体験する
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          )}

          <div className="mt-4">
            <Link href="/banner" className="text-sm text-blue-700 hover:underline">
              ※ ツールの固定URLは <span className="font-mono">/banner</span> です（ここはブレさせません）
            </Link>
          </div>
        </div>
      </section>

      {/* カテゴリ一覧 */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            🎨 対応カテゴリ
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-2xl p-5 border-2 border-gray-200 hover:border-blue-300 transition-all">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mb-3`}>
                  <span className="text-2xl">{cat.icon}</span>
                </div>
                <h3 className="font-bold text-gray-900">{cat.name}</h3>
                <p className="text-sm text-gray-600">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 特徴 */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            ✨ ドヤバナーAIの特徴
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { title: 'A/B/C 3案同時生成', desc: 'ベネフィット・緊急性・社会的証明の3パターンを自動生成' },
              { title: '6種類のサイズ', desc: 'Instagram、Facebook広告、ストーリーズなど主要サイズに対応' },
              { title: '高品質PNG出力', desc: 'そのまま広告に使える高解像度PNGで出力' },
              { title: 'ブランドカラー設定', desc: '自社のブランドカラーを設定して統一感を維持' },
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 料金 */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            💰 料金プラン
          </h2>
          <p className="text-center text-gray-600 mb-8">
            無料版と有料版（¥4,980 / 1日30回）だけのシンプル設計
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {BANNER_PRICING.plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-4 rounded-2xl relative ${
                  plan.popular
                    ? 'bg-gradient-to-br from-blue-50 to-blue-50 border-2 border-blue-300'
                    : 'bg-white border-2 border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                    人気
                  </div>
                )}
                <h3 className="text-base font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{plan.description}</p>
                <p className={`text-xl font-bold mb-1 ${plan.popular ? 'text-blue-600' : 'text-gray-900'}`}>
                  {plan.priceLabel}
                </p>
                {plan.period && <p className="text-xs text-gray-500 mb-3">{plan.period}</p>}
                <ul className="space-y-1 text-gray-600 text-xs mb-4">
                  {plan.features.slice(0, 3).map((feature, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className={plan.popular ? 'text-orange-500' : 'text-blue-500'}>✓</span>
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                {plan.price === 0 ? (
                  <Link href="/banner">
                    <button className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors">
                      {plan.cta}
                    </button>
                  </Link>
                ) : (
                  <Link href="/banner/pricing">
                    <button className={`w-full py-2 text-xs font-bold rounded-lg transition-colors ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-800'
                    }`}>
                      {plan.cta}
                    </button>
                  </Link>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/banner/pricing" className="text-blue-600 hover:underline">
              詳しい料金・機能比較を見る →
            </Link>
          </p>
        </div>
      </section>

      {/* ドヤマーケ CTA */}
      <section className="py-12 px-4 bg-gradient-to-br from-blue-500 via-blue-500 to-blue-500">
        <div className="max-w-3xl mx-auto">
          <a
            href="https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-4xl">💬</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-white">無料相談</span>
                    <span className="text-white/80 text-sm">by ドヤマーケ</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    マーケティングのお悩み、いつでも相談OK！
                  </h3>
                  <p className="text-white/80">
                    バナー制作・広告運用・SNS戦略・LP制作など、マーケティングに関することなら何でもご相談ください。プロがあなたのビジネスをサポートします。
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <ArrowRight className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* 他サービスへの誘導 */}
      <section className="py-12 px-4 bg-gradient-to-br from-blue-50 to-blue-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            📝 他のサービスもチェック
          </h2>

          <Link href="/kantan">
            <div className="bg-white rounded-2xl p-6 border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center">
                  <span className="text-3xl">📝</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">カンタンドヤAI</h3>
                  <p className="text-gray-600">ビジネス文章をAIが自動生成。メール、ブログ、SNS投稿など68種類のテンプレート。</p>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 px-4 border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-6 mb-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
              ポータルに戻る
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/kantan" className="text-blue-500 hover:text-blue-700 text-sm">
              カンタンドヤAI
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/admin" className="text-gray-500 hover:text-gray-700 text-sm">
              管理画面
            </Link>
          </div>
          <p className="text-center text-xs text-gray-400">
            © 2025 ドヤAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}


