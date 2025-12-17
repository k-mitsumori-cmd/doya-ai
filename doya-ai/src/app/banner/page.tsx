'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Crown, LogIn, Check } from 'lucide-react'
import { getServiceById } from '@/lib/services'

// カテゴリ一覧
const categories = [
  { id: 'telecom', name: '通信向け', icon: '📱', desc: '格安SIM・光回線', color: 'from-blue-500 to-cyan-500' },
  { id: 'marketing', name: 'マーケティング', icon: '📊', desc: 'リード獲得', color: 'from-purple-500 to-pink-500' },
  { id: 'ec', name: 'EC向け', icon: '🛒', desc: 'セール・キャンペーン', color: 'from-amber-500 to-orange-500' },
  { id: 'recruit', name: '採用向け', icon: '👥', desc: '求人・説明会', color: 'from-emerald-500 to-green-500' },
  { id: 'beauty', name: '美容・コスメ', icon: '💄', desc: 'スキンケア・化粧品', color: 'from-pink-500 to-rose-500' },
  { id: 'food', name: '飲食・フード', icon: '🍽️', desc: 'レストラン・デリバリー', color: 'from-red-500 to-orange-500' },
]

export default function BannerTopPage() {
  const { data: session } = useSession()
  const service = getServiceById('banner')!
  const plan = (session?.user as any)?.bannerPlan || 'FREE'
  const isPro = plan === 'PRO'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← ポータル
            </Link>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-xl">🎨</span>
              </div>
              <span className="font-bold text-gray-800">ドヤバナーAI</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {session ? (
              <>
                {isPro ? (
                  <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-full">
                    <Crown className="w-4 h-4" />
                    プロ
                  </div>
                ) : (
                  <Link href="/banner/pricing" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                    アップグレード
                  </Link>
                )}
                <Link href="/banner/dashboard" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
                  ダッシュボード
                </Link>
              </>
            ) : (
              <Link href="/auth/signin?service=banner" className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            A/B/C 3案同時生成
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            プロ品質のバナーを<br />
            <span className="text-purple-600">ワンボタンで生成</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            カテゴリを選んでキーワードを入力するだけ。<br />
            AIがA/B/Cの3案を同時に生成します。
          </p>
          
          {session ? (
            <Link href="/banner/dashboard">
              <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-bold rounded-2xl shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 mx-auto">
                バナーを作成する
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          ) : (
            <Link href="/auth/signin?service=banner">
              <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-bold rounded-2xl shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 mx-auto">
                無料で始める
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          )}
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
              <div key={cat.id} className="bg-white rounded-2xl p-5 border-2 border-gray-200 hover:border-purple-300 transition-all">
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
                <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
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
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            💰 料金プラン
          </h2>
          
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-2xl border-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-2">無料プラン</h3>
              <p className="text-3xl font-bold text-gray-900 mb-4">¥0<span className="text-base font-normal text-gray-500">/月</span></p>
              <ul className="space-y-2 text-gray-600 mb-6">
                <li>✓ 1日1枚まで生成</li>
                <li>✓ 全カテゴリ利用可能</li>
                <li>✓ 標準解像度出力</li>
              </ul>
              <Link href="/auth/signin?service=banner">
                <button className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors">
                  無料で始める
                </button>
              </Link>
            </div>
            
            <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-300 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-sm font-bold rounded-full">
                おすすめ
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">プロプラン</h3>
              <p className="text-3xl font-bold text-purple-600 mb-4">¥9,980<span className="text-base font-normal text-gray-500">/月</span></p>
              <ul className="space-y-2 text-gray-600 mb-6">
                <li>✓ 無制限に生成</li>
                <li>✓ 全カテゴリ利用可能</li>
                <li>✓ 高解像度出力</li>
                <li>✓ ブランドカラー設定</li>
              </ul>
              <Link href="/banner/pricing">
                <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-colors">
                  プロプランに登録
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 px-4 border-t border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
            ← ドヤAIポータルに戻る
          </Link>
        </div>
      </footer>
    </div>
  )
}

