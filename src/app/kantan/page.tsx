'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Crown, LogIn } from 'lucide-react'
import { getServiceById } from '@/lib/services'
import { KANTAN_PRICING } from '@/lib/pricing'

// 人気テンプレート
const templates = [
  { 
    id: 'business-email', 
    name: 'ビジネスメール', 
    icon: '📧', 
    desc: '丁寧なメールを作成',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  },
  { 
    id: 'blog-article', 
    name: 'ブログ記事', 
    icon: '📝', 
    desc: '読みやすい記事を作成',
    color: 'bg-green-50 border-green-200 hover:border-green-400',
  },
  { 
    id: 'instagram-caption', 
    name: 'SNS投稿', 
    icon: '📱', 
    desc: 'SNS用の投稿文を作成',
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400',
  },
  { 
    id: 'catchcopy', 
    name: 'キャッチコピー', 
    icon: '✨', 
    desc: '魅力的なキャッチコピー',
    color: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400',
  },
  { 
    id: 'meeting-minutes', 
    name: '議事録', 
    icon: '📋', 
    desc: '会議の議事録を作成',
    color: 'bg-orange-50 border-orange-200 hover:border-orange-400',
  },
  { 
    id: 'proposal-document', 
    name: '提案書', 
    icon: '📑', 
    desc: '企画提案書を作成',
    color: 'bg-pink-50 border-pink-200 hover:border-pink-400',
  },
]

export default function KantanTopPage() {
  const { data: session } = useSession()
  const service = getServiceById('kantan')!
  const plan = (session?.user as any)?.kantanPlan || 'FREE'
  const isPro = plan === 'PRO'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-blue-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← ポータル
            </Link>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-xl">📝</span>
              </div>
              <span className="font-bold text-gray-800">カンタンドヤAI</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {session ? (
              <>
                {isPro ? (
                  <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium rounded-full">
                    <Crown className="w-4 h-4" />
                    プロ
                  </div>
                ) : (
                  <Link href="/kantan/pricing" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    アップグレード
                  </Link>
                )}
                <Link href="/kantan/dashboard" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  ダッシュボード
                </Link>
              </>
            ) : (
              <Link href="/auth/signin?service=kantan" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            68種類のテンプレート
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ビジネス文章を<br />
            <span className="text-blue-600">AIが自動生成</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            メール、ブログ、SNS投稿、提案書…<br />
            テンプレートを選んで情報を入力するだけ。
          </p>
          
          {session ? (
            <Link href="/kantan/dashboard">
              <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-lg font-bold rounded-2xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 mx-auto">
                文章を作成する
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          ) : (
            <Link href="/auth/signin?service=kantan">
              <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-lg font-bold rounded-2xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 mx-auto">
                無料で始める
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          )}
        </div>
      </section>

      {/* テンプレート一覧 */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            📝 人気のテンプレート
          </h2>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {templates.map((template) => (
              <Link key={template.id} href={session ? `/kantan/dashboard/text/${template.id}` : '/auth/signin?service=kantan'}>
                <div className={`${template.color} rounded-2xl p-5 border-2 transition-all cursor-pointer`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <span className="text-3xl">{template.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                      <p className="text-gray-600">{template.desc}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Link href={session ? '/kantan/dashboard' : '/auth/signin?service=kantan'}>
              <button className="px-6 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-xl transition-colors">
                すべてのテンプレートを見る（68種類）
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 料金 */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            💰 料金プラン
          </h2>
          <p className="text-center text-gray-600 mb-8">
            まずは無料でお試し。使い方に合わせてアップグレード。
          </p>
          
          <div className="grid sm:grid-cols-3 gap-5">
            {KANTAN_PRICING.plans.map((plan, index) => (
              <div 
                key={plan.id}
                className={`p-5 rounded-2xl relative ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300' 
                    : 'bg-gray-50 border-2 border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                    人気
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
                <p className={`text-2xl font-bold mb-1 ${plan.popular ? 'text-blue-600' : 'text-gray-900'}`}>
                  {plan.priceLabel}
                  {plan.period && <span className="text-sm font-normal text-gray-500">{plan.period}</span>}
                </p>
                <ul className="space-y-1.5 text-gray-600 text-sm mb-5 mt-4">
                  {plan.features.slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={plan.popular ? 'text-blue-500' : 'text-green-500'}>✓</span>
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                {plan.price === 0 ? (
                  <Link href="/kantan/dashboard">
                    <button className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold rounded-xl transition-colors">
                      {plan.cta}
                    </button>
                  </Link>
                ) : (
                  <Link href="/kantan/pricing">
                    <button className={`w-full py-2.5 text-sm font-bold rounded-xl transition-colors ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white' 
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}>
                      {plan.cta}
                    </button>
                  </Link>
                )}
              </div>
            ))}
          </div>
          
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/kantan/pricing" className="text-blue-600 hover:underline">
              詳しい料金・機能比較を見る →
            </Link>
          </p>
        </div>
      </section>

      {/* 他サービスへの誘導 */}
      <section className="py-12 px-4 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            🎨 他のサービスもチェック
          </h2>
          
          <Link href="/banner">
            <div className="bg-white rounded-2xl p-6 border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-3xl">🎨</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">ドヤバナーAI</h3>
                  <p className="text-gray-600">プロ品質のバナーをワンボタンで自動生成。A/B/Cの3案を同時に作成。</p>
                </div>
                <ArrowRight className="w-6 h-6 text-purple-500" />
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
            <Link href="/banner" className="text-purple-500 hover:text-purple-700 text-sm">
              ドヤバナーAI
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

